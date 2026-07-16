numi.addFunction({ "id": "minimum", "phrases": "minimum" }, function(values) {
	return { "double": Math.min(...values.map(value => value.double)) };
});

numi.addFunction({ "id": "maximum", "phrases": "maximum" }, function(values) {
	return { "double": Math.max(...values.map(value => value.double)) };
});
