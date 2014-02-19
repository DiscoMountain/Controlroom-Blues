//Draw the keyboard for the puzzle

function keyboard(){
	var sampleSVG = d3.select("#view")
		.append("svg")
		.attr("id", "main-svg")
		.attr("width", 500)
		.attr("height", 500);
		
	var keys = [1,2,3,4,5,6,7,8,9];
	var sequence = [1,3,5,4];
	var hack =[];
	var solved = false;
	
	sampleSVG.selectAll("rect")
		.data(keys)
	   .enter().append("rect")
		.style("stroke", "gray")
		.style("fill", "white")
		.attr("width", 40)
		.attr("height", 40)
		//has to be a better way...
		.attr("x", function(i){
			if (i<4){return i*50};
			if (i<7){return (i-3)*50};
			if (i<10){return (i-6)*50};
			})
		.attr("y", function(i){
			var row = 50;
			if (i>3){row = 100;};
			if (i>6){row = 150;};
			return row;
			})
		.on("mouseover", function(){d3.select(this).style("fill", "aliceblue");})
		.on("mouseout", function(){d3.select(this).style("fill", "white");})
		.on("mousedown", function(d){
			hack.push(d);
			if (hack.lenght = 4){
				if (hack = sequence){
					solved = true;
				}
			}
			});	
		
	sampleSVG.append("rect")
		.style("stroke", "gray")
		.style("fill", "aliceblue")
		.attr("width", 40)
		.attr("height", 20)	
		.attr("x", 50)
		.attr("y", 200);
		
	sampleSVG.append("rect")
		.style("stroke", "gray")
		.style("fill", "aliceblue")
		.attr("width", 40)
		.attr("height", 20)	
		.attr("x", 100)
		.attr("y", 200);
		.on("mousedown", function(){d3.select(main-svg).remove();});

}


