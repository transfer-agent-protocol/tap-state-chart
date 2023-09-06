// Helper function to merge nested objects
export const mergeNestedObjects = (target, source) => {
  for (const key in source) {
    if (typeof target[key] === 'object' && typeof source[key] === 'object') {
      mergeNestedObjects(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
};
