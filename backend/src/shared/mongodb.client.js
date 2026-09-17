const mongoose = require('mongoose');
const { User, Project, ProjectVersion, Contact } = require('../models');

const connectMongoDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.DATABASE_URL);
  console.log('Connected to MongoDB');
};

const modelMap = { user: User, project: Project, projectVersion: ProjectVersion, contact: Contact };

const plain = (document) => document ? document.toObject({ flattenMaps: true }) : null;
const matches = (document, where = {}) => Object.entries(where).every(([key, value]) => document[key] === value);
const projectDocument = async (document, options = {}) => {
  if (!document) return null;
  let result = plain(document);
  result.id = result._id;
  if (options.select) {
    result = Object.fromEntries(Object.keys(options.select).filter((key) => options.select[key]).map((key) => [key, result[key]]));
  }
  if (options.include?.versions) {
    let versions = await ProjectVersion.find({ projectId: result.id || result._id }).sort({ createdAt: -1 });
    result.versions = versions.map((version) => {
      const item = plain(version);
      item.id = item._id;
      delete item._id;
      return item;
    });
  }
  delete result._id;
  return result;
};

const createDelegate = (name) => {
  const Model = modelMap[name];
  const prepare = (data) => ({ ...data, _id: data.id || undefined });
  return {
    async count({ where } = {}) {
      return Model.countDocuments(Object.fromEntries(Object.entries(where || {}).map(([key, value]) => [key === 'id' ? '_id' : key, value])));
    },
    async findUnique({ where, select, include } = {}) {
      const key = Object.keys(where || {})[0];
      return projectDocument(await Model.findOne({ [key === 'id' ? '_id' : key]: where[key] }), { select, include });
    },
    async findFirst({ where, select, include, orderBy } = {}) {
      let query = Model.findOne(Object.fromEntries(Object.entries(where || {}).map(([key, value]) => [key === 'id' ? '_id' : key, value])));
      if (orderBy) query = query.sort(orderBy);
      return projectDocument(await query, { select, include });
    },
    async findMany({ where, select, include, orderBy } = {}) {
      let query = Model.find(Object.fromEntries(Object.entries(where || {}).map(([key, value]) => [key === 'id' ? '_id' : key, value])));
      if (orderBy) query = query.sort(orderBy);
      const documents = await query;
      return Promise.all(documents.map((document) => projectDocument(document, { select, include })));
    },
    async create({ data, include } = {}) {
      return projectDocument(await Model.create(prepare(data)), { include });
    },
    async update({ where, data, select, include } = {}) {
      const id = where.id || where._id;
      const update = {};
      for (const [key, value] of Object.entries(data || {})) {
        update[key] = value && typeof value === 'object' && 'increment' in value
          ? { $inc: value.increment }
          : value;
      }
      const updateOperators = Object.values(update).some((value) => value && typeof value === 'object' && '$inc' in value);
      const normalized = {};
      for (const [key, value] of Object.entries(update)) {
        if (value && typeof value === 'object' && '$inc' in value) {
          normalized.$inc = { ...(normalized.$inc || {}), [key]: value.$inc };
        } else {
          normalized.$set = { ...(normalized.$set || {}), [key]: value };
        }
      }
      return projectDocument(await Model.findOneAndUpdate(
        { _id: id },
        updateOperators ? normalized : { $set: data },
        { new: true, runValidators: true },
      ), { select, include });
    },
    async delete({ where } = {}) {
      const id = where.id || where._id;
      const document = await Model.findOneAndDelete({ _id: id });
      return projectDocument(document);
    },
    async deleteMany({ where } = {}) {
      return Model.deleteMany(Object.fromEntries(Object.entries(where || {}).map(([key, value]) => [key === 'id' ? '_id' : key, value])));
    },
  };
};

const db = {
  user: createDelegate('user'),
  project: createDelegate('project'),
  projectVersion: createDelegate('projectVersion'),
  contact: createDelegate('contact'),
  async $transaction(callback) {
    return callback(db);
  },
};

module.exports = { ...db, connectMongoDB };
