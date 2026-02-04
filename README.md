# @mongodb-js/mongodb-zod

zod + mongodb = <3

```js
import { withSchema } from '@mongodb-js/mongodb-zod';

const client = await MongoClient.connect(process.env.MONGODB_URI);
const coll = withSchema(
  client.db('test').collection('users'),
  z.object({
    _id: z.string(),
    name: z.string(),
    age: z.number().min(0),
  }),
);

await coll.installSchemaValidation();
```

Experimental – external contributions welcome!

## License

Apache 2.0
