// YAML read/write utilities

import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

export function readYamlFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, "utf-8");
  return yaml.parse(content) as T;
}

export function writeYamlFile<T>(filePath: string, data: T): void {
  const content = yaml.stringify(data, {
    lineWidth: 0, // Don't wrap lines
    indent: 2,
  });
  fs.writeFileSync(filePath, content, "utf-8");
}

export function readYamlFileIfExists<T>(filePath: string, defaultValue: T): T {
  if (fs.existsSync(filePath)) {
    return readYamlFile<T>(filePath);
  }
  return defaultValue;
}

export function listYamlFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(dirPath, f));
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
