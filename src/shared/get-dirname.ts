import GLib from "gi://GLib?version=2.0";
import path from "./path";

export const getDirname = (metaUri: string) => {
  const uri = GLib.uri_parse(metaUri, GLib.UriFlags.NONE);
  if (uri === null) {
    throw new Error(`Invalid URI: ${metaUri}`);
  }

  const filename = GLib.uri_unescape_string(uri.get_path(), null);
  if (filename === null) {
    throw new Error(`Invalid URI: ${metaUri}`);
  }

  return path.dirname(filename);
};
