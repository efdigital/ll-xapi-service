import NoModel from 'jscommons/dist/errors/NoModel';
import DeleteStateOptions from '../repoFactory/options/DeleteStateOptions';
import DeleteStateResult from '../repoFactory/results/DeleteStateResult';
import Config from './Config';
import { COLLECTION_NAME } from './utils/constants';
import getStateFilter from './utils/getStateFilter';

export default (config: Config) => {
  return async (opts: DeleteStateOptions): Promise<DeleteStateResult> => {
    const collection = (await config.db()).collection(COLLECTION_NAME);

    const stateFilter = getStateFilter(opts);

    // Deletes the document if it matches the state and etag filters.
    // Docs: http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndDelete
    // Docs: http://bit.ly/findAndModifyWriteOpResult
    const opResult = await collection.findOneAndDelete(stateFilter, {});

    // Determines if the identifier was deleted.
    // In MongoDB driver 6.x, check if we got a result back (value exists)
    const wasDeleted = opResult !== null && opResult.value !== null;

    // Returns the result of the deletion if the document was deleted.
    if (wasDeleted) {
      const deletedDoc = opResult.value as any;
      return {
        content: deletedDoc.content === null ? undefined : deletedDoc.content,
        extension: deletedDoc.extension,
        id: deletedDoc._id.toString(),
      };
    }

    /* istanbul ignore next */
    throw new NoModel('State');
  };
};
