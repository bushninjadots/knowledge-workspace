import {
  File as FileIcon,
  Image,
  Film,
  Music,
  Box,
  Archive,
  Palette,
  FileText,
  FileCode,
} from "lucide-react";

export type ProjectFile = {
  name: string;
  path: string;
  size: number;
  type: "image" | "video" | "audio" | "model" | "archive" | "document" | "other";
  uploaded_at: string;
  /** Optional relative directory (e.g. "src/components") for repo-style trees. */
  dir?: string;
};

export function getFileIconType(name: string): typeof FileIcon {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return Image;
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return Film;
  if (["mp3", "wav", "aac", "ogg", "flac", "m4a"].includes(ext)) return Music;
  if (["blend", "fbx", "obj", "stl", "glb", "gltf"].includes(ext)) return Box;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return Archive;
  if (["psd", "ai", "fig", "sketch"].includes(ext)) return Palette;
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) return FileText;
  if (["js", "ts", "py", "html", "css", "json"].includes(ext)) return FileCode;
  return FileIcon;
}

export function getFileType(name: string): ProjectFile["type"] {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "aac", "ogg", "flac", "m4a"].includes(ext)) return "audio";
  if (["blend", "fbx", "obj", "stl", "glb", "gltf", "usd"].includes(ext)) return "model";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (["pdf", "doc", "docx", "ppt", "xls"].includes(ext)) return "document";
  return "other";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
