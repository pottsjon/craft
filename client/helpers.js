Template.registerHelper('toLowerCase', function(str) {
	return str.toLowerCase();
});

Template.registerHelper('toDollars', function(str) {
	return toDollars(str);
});

Template.registerHelper('toNumbers', function(str) {
	return toNumbers(str);
});