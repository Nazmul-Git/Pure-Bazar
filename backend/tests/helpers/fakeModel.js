// Minimal in-memory stand-in for a Mongoose model: real documents (so schema
// validation and setters run) kept in an array instead of MongoDB.
const same = (a, b) => String(a) === String(b);

function matches(doc, filter) {
  return Object.entries(filter || {}).every(([key, cond]) => {
    const value = doc[key];
    if (cond && typeof cond === 'object' && cond.$in) return cond.$in.some((item) => same(item, value));
    if (cond === null) return value === null || value === undefined;
    return same(cond, value);
  });
}

function query(items) {
  const promise = Promise.resolve(items);
  promise.sort = () => promise;
  promise.lean = () => Promise.resolve(items.map((doc) => doc.toObject()));
  return promise;
}

function fakeModel(Real, store) {
  const duplicate = (doc) => {
    const unique = { Employee: 'employeeCode', ExpenseCategory: 'name', SalarySheet: 'month' }[Real.modelName];
    if (unique && store.some((other) => other[unique] === doc[unique])) {
      return Object.assign(new Error('duplicate key'), { code: 11000 });
    }
    if (Real.modelName === 'Expense' && doc.sourceType === 'SALARY_SHEET'
      && store.some((other) => same(other.sourceId, doc.sourceId))) {
      return Object.assign(new Error('duplicate key'), { code: 11000 });
    }
    return null;
  };

  return {
    create: async (data) => {
      const doc = new Real(data);
      await doc.validate();
      const error = duplicate(doc);
      if (error) throw error;
      doc.save = async function save() { await this.validate(); return this; };
      store.push(doc);
      return doc;
    },
    find: (filter) => query(store.filter((doc) => matches(doc, filter))),
    findOne: async (filter) => store.find((doc) => matches(doc, filter)) || null,
    findById: async (id) => store.find((doc) => same(doc._id, id)) || null,
    deleteOne: async (filter) => {
      const index = store.findIndex((doc) => matches(doc, filter));
      if (index >= 0) store.splice(index, 1);
    },
    updateMany: async (filter, update) => {
      const docs = store.filter((doc) => matches(doc, filter));
      docs.forEach((doc) => {
        if (update.$set) Object.entries(update.$set).forEach(([k, v]) => { doc[k] = v; });
        if (update.$unset) Object.keys(update.$unset).forEach((k) => { doc[k] = undefined; });
      });
      return { modifiedCount: docs.length };
    },
  };
}

module.exports = { fakeModel };
