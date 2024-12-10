import _ from "lodash";

type Obj = object | any[];

type CyclicReference = {
  firstPath: string;
  secondPath: string;
  value: Obj;
};

type Parent = {
  path: string[];
  value: Obj;
};

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null;
}

function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

function getOwnParent(parents: Parent[], value: Obj) {
  for (let i = parents.length - 1; i >= 0; i--) {
    const p = parents[i]!;
    if (Object.is(value, p.value)) {
      return p;
    }
  }
}

function findCyclicRefs(value: Obj) {
  const cyclicReferences: CyclicReference[] = [];

  const traverse = (nextValue: Obj, parents: Parent[]) => {
    const keys = Object.keys(nextValue);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      // @ts-expect-error
      const value = nextValue[key]!;

      const parent = last(parents);
      const path = [...(parent?.path ?? []), key];

      if (isObj(value)) {
        const ownParent = getOwnParent(parents, value);

        if (ownParent) {
          cyclicReferences.push({
            firstPath: ownParent.path.join("."),
            secondPath: path.join("."),
            value,
          });
        } else {
          traverse(value, [...parents, { path, value }]);
        }
      }
    }
  };

  traverse(value, [{ value, path: [] }]);

  return cyclicReferences;
}

export function hasCyclicRefs(obj: Obj) {
  return findCyclicRefs(obj).length > 0;
}

function extGet(obj: Obj, path: string): any {
  return path.length === 0 ? obj : _.get(obj, path);
}

export function replaceCyclicRefs<O extends Obj>(
  obj: O,
  replacer: (cyclicRef: CyclicReference, obj: O) => unknown,
) {
  const clonedObj = _.cloneDeep(obj);
  const cyclicReferences = findCyclicRefs(clonedObj);

  for (let i = 0; i < cyclicReferences.length; i++) {
    const cyclicRef = cyclicReferences[i]!;

    const a = extGet(clonedObj, cyclicRef.firstPath);
    const b = extGet(clonedObj, cyclicRef.secondPath);

    if (a && b && Object.is(a, b)) {
      _.set(clonedObj, cyclicRef.secondPath, replacer(cyclicRef, clonedObj));
    } else {
      replacer(cyclicRef, clonedObj);
    }
  }

  return clonedObj;
}
