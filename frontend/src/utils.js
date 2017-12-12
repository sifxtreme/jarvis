function filterFloat(value) {
  if (/^(\|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/.test(value))
    return Number(value);
  return NaN;
}

export function sortByKey(array, key) {
  return array.sort(function(a, b) {
    let x = a[key]; 
    let y = b[key];
    if(x === null) x = ""
    if(y === null) y = ""
    x = x.toLowerCase();
    y = y.toLowerCase();
    if(!Number.isNaN(filterFloat(x))) x = parseFloat(x)
    if(!Number.isNaN(filterFloat(y))) y = parseFloat(y)
    return ((x < y) ? -1 : ((x > y) ? 1 : 0));
  });
}

export function clone(old) {
  return JSON.parse(JSON.stringify(old));
};