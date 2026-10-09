import type { ToolArguments } from "./types";

/** Thrown for invalid tool arguments. The message is sent to the model. */
export class ToolArgumentError extends Error {}

export function requireString(args: ToolArguments, name: string): string {
  const value = args[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new ToolArgumentError(`"${name}" must be a non-empty string.`);
  }
  return value;
}

export function optionalString(args: ToolArguments, name: string): string | undefined {
  const value = args[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ToolArgumentError(`"${name}" must be a string.`);
  }
  return value;
}

export function optionalBoolean(args: ToolArguments, name: string): boolean | undefined {
  const value = args[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new ToolArgumentError(`"${name}" must be a boolean.`);
  }
  return value;
}

export function optionalInteger(args: ToolArguments, name: string): number | undefined {
  const value = args[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ToolArgumentError(`"${name}" must be an integer.`);
  }
  return value;
}

export function requireOneOf<T extends string>(args: ToolArguments, name: string, allowed: readonly T[]): T {
  const value = args[name];
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new ToolArgumentError(`"${name}" must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

export function optionalNumber(args: ToolArguments, name: string): number | undefined {
  const value = args[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ToolArgumentError(`"${name}" must be a number.`);
  }
  return value;
}

export function optionalOneOf<T extends string>(
  args: ToolArguments,
  name: string,
  allowed: readonly T[]
): T | undefined {
  return args[name] === undefined || args[name] === null ? undefined : requireOneOf(args, name, allowed);
}

export function optionalObject(args: ToolArguments, name: string): ToolArguments | undefined {
  const value = args[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ToolArgumentError(`"${name}" must be an object.`);
  }
  return value as ToolArguments;
}

export function requireObjectArray(args: ToolArguments, name: string): ToolArguments[] {
  const value = args[name];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "object" || item === null || Array.isArray(item))) {
    throw new ToolArgumentError(`"${name}" must be an array of objects.`);
  }
  return value as ToolArguments[];
}

export function optionalStringArray(args: ToolArguments, name: string): string[] | undefined {
  const value = args[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ToolArgumentError(`"${name}" must be an array of strings.`);
  }
  return value as string[];
}

export function requireNumberArray(args: ToolArguments, name: string): number[] {
  const value = args[name];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    throw new ToolArgumentError(`"${name}" must be an array of numbers.`);
  }
  return value as number[];
}

/** A non-empty array of rows of strings. */
export function requireStringMatrix(args: ToolArguments, name: string): string[][] {
  const value = args[name];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((row) => !Array.isArray(row) || row.some((cell) => typeof cell !== "string"))
  ) {
    throw new ToolArgumentError(`"${name}" must be a non-empty array of rows of strings.`);
  }
  return value as string[][];
}

export function optionalPositiveNumber(args: ToolArguments, name: string): number | undefined {
  const value = optionalNumber(args, name);
  if (value !== undefined && value <= 0) {
    throw new ToolArgumentError(`"${name}" must be greater than 0.`);
  }
  return value;
}
