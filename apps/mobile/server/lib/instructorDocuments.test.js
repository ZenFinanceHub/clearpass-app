const test = require('node:test');
const assert = require('node:assert/strict');
const { deleteInstructorDocuments } = require('./instructorDocuments');

function createStubStorage({ files = [], listError = null, removeError = null } = {}) {
  const calls = {};
  return {
    calls,
    async list(prefix) {
      calls.listPrefix = prefix;
      return { data: files, error: listError };
    },
    async remove(paths) {
      calls.removedPaths = paths;
      return { error: removeError };
    },
  };
}

test('deleteInstructorDocuments: removes every file under <uid>/, using its own name', async () => {
  const storage = createStubStorage({ files: [{ name: '1694400000000.jpg' }, { name: '1694400005000.pdf' }] });
  const result = await deleteInstructorDocuments(storage, 'u1');

  assert.deepEqual(result, { error: null, deletedCount: 2 });
  assert.equal(storage.calls.listPrefix, 'u1');
  assert.deepEqual(storage.calls.removedPaths, ['u1/1694400000000.jpg', 'u1/1694400005000.pdf']);
});

test('deleteInstructorDocuments: no files — nothing to remove, not an error', async () => {
  const storage = createStubStorage({ files: [] });
  const result = await deleteInstructorDocuments(storage, 'u2');

  assert.deepEqual(result, { error: null, deletedCount: 0 });
  assert.equal(storage.calls.removedPaths, undefined);
});

test('deleteInstructorDocuments: a list failure is reported, remove is never attempted', async () => {
  const storage = createStubStorage({ listError: { message: 'stub list failure' } });
  const result = await deleteInstructorDocuments(storage, 'u3');

  assert.ok(result.error);
  assert.equal(result.deletedCount, 0);
  assert.equal(storage.calls.removedPaths, undefined);
});

test('deleteInstructorDocuments: a remove failure is reported', async () => {
  const storage = createStubStorage({ files: [{ name: 'a.jpg' }], removeError: { message: 'stub remove failure' } });
  const result = await deleteInstructorDocuments(storage, 'u4');

  assert.ok(result.error);
  assert.equal(result.deletedCount, 0);
});
