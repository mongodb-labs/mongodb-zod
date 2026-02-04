import { tmpdir } from 'os';
import { withSchema } from './';
import { MongoCluster } from 'mongodb-runner';
import { z } from 'zod';
import { expect } from 'chai';

describe('withSchema', function () {
  let cluster: MongoCluster;

  before(async function () {
    this.timeout(180_000);
    cluster = await MongoCluster.start({
      topology: 'replset',
      secondaries: 0,
      tmpDir: tmpdir(),
    });
  });

  after(async function () {
    await cluster?.close();
  });

  it('should attach schema and installSchemaValidation method to collection', async function () {
    await cluster.withClient(async (client) => {
      const coll = withSchema(
        client.db('test').collection('users'),
        z.object({
          _id: z.string(),
          name: z.string(),
          age: z.number().min(0),
        }),
      );

      await coll.installSchemaValidation();
      const collMetadata = await client
        .db('test')
        .listCollections({ name: 'users' }, { nameOnly: false })
        .next();
      expect(collMetadata?.options?.validator.$jsonSchema).to.be.an('object');

      // Check that schema is attached
      const validData = { _id: '1', name: 'Alice', age: 30 };
      const invalidData = { _id: '2', name: 'Bob', age: -5 };

      // Succeeds
      await coll.insertOne(validData);
      const err = await coll.insertOne(invalidData).then(
        () => 0,
        (err) => err,
      );
      expect(err.code).to.equal(121); // Document failed validation
      expect(err.errInfo.details.schemaRulesNotSatisfied[0]).to.deep.equal({
        operatorName: 'properties',
        propertiesNotSatisfied: [
          {
            propertyName: 'age',
            details: [
              {
                operatorName: 'minimum',
                specifiedAs: { minimum: 0 },
                reason: 'comparison failed',
                consideredValue: -5,
              },
            ],
          },
        ],
      });
    });
  });
});
