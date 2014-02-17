//Draw the keyboard for the puzzle
function keyboard(){
	var sampleSVG = d3.select("#view")
		.append("svg")
		.attr("id", "main-svg")
		.attr("width", 500)
		.attr("height", 500);
		/*
	var keys = [1,2,3,4,5,6,7,8,9];

	sampleSVG.selectAll("rect")
		.data(keys)
	   .enter().append("rect")
		.style("stroke", "gray")
		.style("fill", "white")
		.attr("width", 40)
		.attr("height", 40)
		.attr("x", function(d)
		{return d*50;})
		.text(function (d){return d;})
		.on("mouseover", function(){d3.select(this).style("fill", "aliceblue");})
		.on("mouseout", function(){d3.select(this).style("fill", "white");})
		.on("mousedown", function(){d3.select("#keyboard").remove("sampleSVG");});	
		*/	
}

// Trying just to get a popup over the map to begin with.
function puzzled(){
	d3.select("#main-svg").append("rect")
		.style("stroke", "gray")
		.style("fill", "white")
		.attr("width", 200)
		.attr("height", 200)
		.attr("x", 20)
		.attr("y", 20)
		.attr("id", "popup")
		.style("fill", "blue")
		.on("mouseover", function(){d3.select(this).style("fill", "aliceblue");})
		.on("mouseout", function(){d3.select(this).style("fill", "blue");})
		.on("mousedown", function(){d3.select(this).remove();});		
}

