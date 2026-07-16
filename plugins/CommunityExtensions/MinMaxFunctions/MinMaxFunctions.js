numi.addFunction({ "id": "min", "phrases": "min" }, function(values) {
	return { "double": Math.min(...values.map(value => value.double)) };
});

numi.addFunction({ "id": "max", "phrases": "max" }, function(values) {
	return { "double": Math.max(...values.map(value => value.double)) };
});
