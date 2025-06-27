/**
 * MongoDB Driver Compatibility Types
 *
 * This file resolves type conflicts between the upgraded MongoDB driver (6.x)
 * and the jscommons library that uses an older MongoDB driver version.
 */

declare module 'jscommons/dist/mongoRepo/utils/connectToDb' {
  import { Db } from 'mongodb';

  interface ConnectToDbOptions {
    readonly dbName: string;
    readonly logger: any;
    readonly url: string;
  }

  function connectToDb(options: ConnectToDbOptions): () => Promise<Db>;
  export = connectToDb;
}

declare module 'jscommons/dist/mongoRepo/utils/getDbFromUrl' {
  function getDbFromUrl(url: string): string;
  export = getDbFromUrl;
}

// Extend the global MongoDB types to handle compatibility
declare global {
  namespace MongoDB {
    // Ensure ObjectId compatibility between versions
    type CompatObjectId = import('mongodb').ObjectId;

    // Ensure Db compatibility
    type CompatDb = import('mongodb').Db;
  }
}

// Type augmentation for better null safety
declare module 'mongodb' {
  interface FindOneAndDeleteResult<TSchema = Document> {
    lastErrorObject?: {
      n?: number;
      updatedExisting?: boolean;
      upserted?: any;
    } | null;
    value?: TSchema | null;
  }

  interface FindOneAndUpdateResult<TSchema = Document> {
    lastErrorObject?: {
      n?: number;
      updatedExisting?: boolean;
      upserted?: any;
    } | null;
    value?: TSchema | null;
  }
}

export {};
