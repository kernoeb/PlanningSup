// Based on https://github.com/velsa/ts-env

type TGeneralizeType<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T

/**
 * The base type of the value, inferred from `allowed` and `default` options,
 * but before considering whether it's required or can be undefined.
 */
type TValue<
  TAllowedArray extends readonly (string | number)[] | undefined,
  TDefaultType,
> = TAllowedArray extends readonly (infer TElement)[]
  ? TElement // If `allowed` is provided, the type is the union of its elements
  : TDefaultType extends undefined
    ? string // Fallback to string if no other type info is available
    : TGeneralizeType<TDefaultType> // Infer from the default value's type

/**
 * Gets `varName` value from the environment, uses default if needed,
 * checks if value is allowed, and auto-generates return type and type checks.
 *
 * Type support for strings, numbers and booleans.
 * Boolean env vars can be set equal to "true" or "yes" for true value
 * and anything else for false.
 *
 * @param varName Name of the environment variable.
 * @param options `default` value, list of `allowed` values, and `required` flag.
 * @param options.allowed List of allowed values for the env var.
 * @param options.default Default value for the env var. If provided, the function will not return undefined.
 * @param options.required If true, the function will throw an error if the env var is missing and no default is provided.
 * @returns The environment variable's value. The return type is inferred from the options.
 *
 * It will return `undefined` only if the env var is not found, no `default` is set, and `required` is not `true`.
 * It will **throw an error** if:
 * - The env var value is not in the `allowed` list.
 * - `required: true` is set, the env var is not found, and no `default` is provided.
 *
 * **Examples:**
 * ```
 * const myenv = {
 *    // Type: "dev" | "prod" | "test"
 *    // Throws if NODE_ENV is not one of the allowed values.
 *    // Throws if NODE_ENV is not set (because no default is provided).
 *    NODE_ENV: env("NODE_ENV", {
 *      allowed: ["dev", "prod", "test"] as const,
 *      required: true
 *    }),
 *
 *    // Type: number
 *    // Defaults to 3000 if not set. Never undefined.
 *    SERVER_PORT: env("SERVER_PORT", { default: 3000 }),
 *
 *    // Type: string | undefined
 *    // Optional, returns undefined if not set.
 *    API_KEY: env("API_KEY"),
 *
 *    // Type: boolean
 *    // Defaults to false if not set.
 *    ENABLE_FEATURE: env("ENABLE_FEATURE", { default: false }),
 * }
 * ```
 */
export function env<
  // Infer the array of allowed values
  TAllowedArray extends readonly (string | number)[] | undefined = undefined,
  // Infer the default value's type, constrained by the allowed values if they exist
  TDefaultType extends
    | (TAllowedArray extends readonly (infer TElement)[] ? TElement : string | number | boolean)
    | undefined = undefined,
  // Infer the required flag
  TRequired extends boolean | undefined = undefined,
  // ---
  // The final, calculated return type
  TReturnType = TDefaultType extends undefined
    ? TRequired extends true
      ? TValue<TAllowedArray, TDefaultType> // Has no default, but is required -> never undefined
      : TValue<TAllowedArray, TDefaultType> | undefined // Has no default, not required -> can be undefined
    : TValue<TAllowedArray, TDefaultType>, // Has a default -> never undefined
>(
  varName: string,
  options?: {
    readonly allowed?: TAllowedArray
    default?: TDefaultType
    required?: TRequired
  },
): TReturnType {
  const { default: defaultValue, allowed, required } = options || {}
  const value = Bun.env[varName] // Using process.env for broader compatibility

  const typeForParsing = defaultValue !== undefined ? typeof defaultValue : 'string'

  // Helper to check if a value is in the `allowed` array. Throws if not allowed.
  function checkAllowed<T extends string | number>(val: T): T {
    if (allowed === undefined || (allowed as T[]).includes(val)) {
      return val
    }
    throw new Error(
      `ENV ERROR: Value for "${varName}" is not allowed. `
      + `Received "${String(val)}", but expected one of: ${JSON.stringify(allowed)}.`,
    )
  }

  // Case 1: Environment variable is missing or empty.
  if (value === undefined || value.length === 0) {
    if (defaultValue !== undefined) {
      return defaultValue as TReturnType
    }
    if (required) {
      throw new Error(`ENV ERROR: Missing required environment variable: "${varName}".`)
    }
    return undefined as TReturnType
  }

  // Case 2: Environment variable is present, parse it based on inferred type.
  switch (typeForParsing) {
    case 'string':
      return checkAllowed(value) as TReturnType
    case 'number':
      // Check if the parsed number is a valid number (e.g., not NaN)
      if (Number.isNaN(+value)) {
        throw new TypeError(
          `ENV ERROR: Invalid number value for "${varName}". Received: "${value}".`,
        )
      }
      return checkAllowed(+value) as TReturnType
    case 'boolean':
      // No need for `checkAllowed` with booleans, as the parsing is deterministic.
      return ['true', 'yes', '1'].includes(value.toLowerCase()) as TReturnType
    default:
      // This should be unreachable due to TypeScript constraints
      return checkAllowed(value) as TReturnType
  }
}
