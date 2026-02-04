import type { z } from 'zod';
import type { Collection, Document } from 'mongodb';
import type { JSONSchemaGeneratorParams } from 'zod/v4/core';
export type { JSONSchemaGeneratorParams };

export interface CollectionWithZodSchema<
  TSchema extends Document,
> extends Collection<TSchema> {
  readonly schema: z.ZodType<TSchema>;
  installSchemaValidation(): Promise<void>;
}

export interface InstallSchemaOpts {
  validationAction?: 'error' | 'warn';
  validationLevel?: 'off' | 'moderate' | 'strict';
  jsonSchemaOptions?: JSONSchemaGeneratorParams;
}

export function withSchema<
  OriginalTSchema extends Document,
  TSchema extends OriginalTSchema,
>(
  c: Collection<OriginalTSchema>,
  s: z.ZodType<TSchema>,
): CollectionWithZodSchema<TSchema> {
  return Object.assign(c as unknown as Collection<TSchema>, {
    get schema(): z.ZodType<TSchema> {
      return s;
    },
    async installSchemaValidation(opts: InstallSchemaOpts = {}): Promise<void> {
      const jsonSchema = s.toJSONSchema({
        target: 'draft-04',
        ...opts.jsonSchemaOptions,
      });
      delete jsonSchema.$schema; // Not supported by the server
      const collModData = {
        validator: {
          $jsonSchema: jsonSchema,
        },
        validationLevel: opts.validationLevel ?? 'strict',
        validationAction: opts.validationAction ?? 'error',
      };
      try {
        await c.db.command({
          collMod: c.collectionName,
          ...collModData,
        });
        return;
      } catch (e) {
        if (
          e &&
          typeof e === 'object' &&
          'codeName' in e &&
          e.codeName === 'NamespaceNotFound'
        ) {
          await c.db.createCollection(c.collectionName, {
            ...collModData,
          });
          return;
        }
        throw e;
      }
    },
  });
}
