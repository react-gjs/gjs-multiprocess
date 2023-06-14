import _ from "lodash";
import serializeJavascript from "serialize-javascript";
import { replaceCyclicRefs } from "./cyclic-refs";

const deserialize = eval;

export class Serializer {
  private static replaceCyclicReferences(data: any, path: string[] = []) {
    const cycleRefs: [string, string][] = [];

    if (typeof data === "object") {
      data = replaceCyclicRefs(data, (ref, obj) => {
        cycleRefs.push([ref.secondPath, ref.firstPath]);
        return null;
      });
    }

    return { data, cycleRefs };
  }

  private static restoreCyclicReferences(obj: {
    data: any;
    cycleRefs: [string, string][];
  }) {
    const { data, cycleRefs } = obj;

    for (let i = 0; i < cycleRefs.length; i++) {
      const ref = cycleRefs[i]!;
      const v = ref[1] !== "" ? _.get(data, ref[1]) : data;
      _.set(data, ref[0], v);
    }

    return data;
  }

  static stringify(data: any): string {
    return serializeJavascript(this.replaceCyclicReferences(data));
  }

  static parse<T>(data: string): T {
    return this.restoreCyclicReferences(deserialize(`(${data})`));
  }
}
