/**
 * Branded Types Utility
 *
 * Creates a branded type that's structurally incompatible with other brands.
 * The __brand property exists only at compile time - zero runtime overhead.
 *
 * @example
 * type DeviceId = Brand<string, 'DeviceId'>;
 * type UserId = Brand<string, 'UserId'>;
 *
 * const deviceId: DeviceId = 'abc' as DeviceId;
 * const userId: UserId = 'abc' as UserId;
 *
 * deviceId === userId; // Compile error! Types don't match
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/**
 * Extracts the base type from a branded type.
 * Useful when you need to pass a branded type to external code.
 */
export type Unbrand<T> = T extends Brand<infer U, string> ? U : T;

/**
 * Type guard to check if a value matches a specific brand at compile time.
 * Note: This is for type narrowing, not runtime validation.
 */
export type IsBrand<T, B extends string> = T extends Brand<infer _, B>
  ? true
  : false;
