import { isPlainObject } from 'lodash';
import { ObjectId, ReturnDocument } from 'mongodb';
import IfMatch from '../errors/IfMatch';
import IfNoneMatch from '../errors/IfNoneMatch';
import MaxEtags from '../errors/MaxEtags';
import OverwriteProfileOptions from '../repoFactory/options/OverwriteProfileOptions';
import OverwriteProfileResult from '../repoFactory/results/OverwriteProfileResult';
import Config from './Config';
import { COLLECTION_NAME } from './utils/constants';

// Within this code, Etags (ifMatch/ifNoneMatch) are used to manage concurrent creates/updates.
// Docs: https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Communication.md#concurrency

export default (config: Config) => {
  return async (opts: OverwriteProfileOptions): Promise<OverwriteProfileResult> => {
    const collection = (await config.db()).collection(COLLECTION_NAME);
    const checkIfMatch = opts.ifMatch !== undefined;
    const checkIfNoneMatch = opts.ifNoneMatch === '*';

    if (checkIfMatch && checkIfNoneMatch) {
      throw new MaxEtags();
    }

    const profileFilter = {
      activityId: opts.activityId,
      lrs: new ObjectId(opts.client.lrs_id),
      organisation: new ObjectId(opts.client.organisation),
      profileId: opts.profileId,
    };

    const update = {
      // Overwrites the content and contentType.
      content: opts.content,
      contentType: opts.contentType,
      etag: opts.etag,
      extension: opts.extension,
      isObjectContent: isPlainObject(opts.content),

      // Updates updatedAt time.
      updatedAt: new Date(),
    };

    // Attempts to update the profile because the ifMatch option is provided.
    if (checkIfMatch) {
      const ifMatchFilter = { etag: opts.ifMatch };

      // Updates the profile if it exists with the correct ETag.
      // Docs: http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate
      // Docs: http://bit.ly/findAndModifyWriteOpResult
      const updateOpResult = await collection.findOneAndUpdate(
        {
          ...ifMatchFilter,
          ...profileFilter,
        },
        {
          $set: update,
        },
        {
          returnDocument: ReturnDocument.AFTER, // Ensures the updated document is returned.
          upsert: false, // Does not create the profile when it doesn't exist.
          includeResultMetadata: true, // Maintains backward compatibility with MongoDB driver 4.x behavior
        },
      );

      // Determines if the Profile was updated.
      // In MongoDB driver 6.x, check if we got a result back (value exists) and no upsert occurred
      const wasUpdated =
        updateOpResult !== null &&
        updateOpResult.value !== null &&
        !updateOpResult.lastErrorObject?.upserted;
      if (wasUpdated) {
        const opResult = await collection.findOne({ _id: updateOpResult.value?._id });

        return {
          extension: opResult?.extension,
          id: opResult?._id.toString() as string,
        };
      }
    }

    const createOpResult = await collection.findOneAndUpdate(
      profileFilter,
      {
        $setOnInsert: update,
      },
      {
        returnDocument: ReturnDocument.AFTER,
        upsert: true,
        includeResultMetadata: true, // Maintains backward compatibility with MongoDB driver 4.x behavior
      },
    );

    const wasCreated = !createOpResult.lastErrorObject?.updatedExisting;

    // Throws the IfMatch error when the profile already exists.
    // This is because there must have been an ETag mismatch in the previous update.
    if (!wasCreated && checkIfMatch) {
      throw new IfMatch();
    }

    if (!wasCreated && checkIfNoneMatch) {
      throw new IfNoneMatch();
    }

    const id = wasCreated ? createOpResult.lastErrorObject?.upserted : createOpResult.value?._id;

    const opResult = await collection.findOne({ _id: id });

    return {
      extension: opResult?.extension,
      id: opResult?._id.toString() as string,
    };
  };
};
