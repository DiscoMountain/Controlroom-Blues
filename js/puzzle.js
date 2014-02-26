//Draw the keyboard for the puzzle

function keyboard(){
	d3.select("#view")
		.append("div")
		.attr("id", "puzzlebox")

	var sampleSVG = d3.select("#puzzlebox")
		.append("svg")
		.attr("id", "main-svg")
		.attr("width", 200)
		.attr("height", 260);
		
	var keys = [1,2,3,4,5,6,7,8,9];
	var sequence = [1,3,5,4];
	var hack =[];
	var solved = false;
	var hacking = false;

	
	//Create keypad
	sampleSVG.selectAll("rect")
		.data(keys)
	   .enter().append("rect")
		.style("stroke", "gray")
		.style("fill", "white")
		.attr("width", 40)
		.attr("height", 40)
		.attr("id", function(d){return "id"+d;})
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
		.on("mouseover", function(){d3.select(this).style("fill", "blue");})
		.on("mouseout", function(){d3.select(this).style("fill", "white");})
		.on("mousedown", function(d){
			if (hacking == false){return;}
			hack.push(d);
			if (hack.lenght == 4){
				if (hack = sequence){
					solved = true;
				}
			console.log("number of keypresses is " + hack.length)
			}
			});	
	
	//Create Hack button
	sampleSVG.append("rect")
		.style("stroke", "gray")
		.style("fill", "aliceblue")
		.attr("width", 40)
		.attr("height", 20)	
		.attr("x", 50)
		.attr("y", 200)
		.on("mousedown", animate_sequence); 

	sampleSVG.append("text")
		.attr("x", 60)
		.attr("y", 210)
		.attr("font-size", 10)
		.text("Hack");
	

	//Create cancel button and text
	sampleSVG.append("rect")
		.style("stroke", "gray")
		.style("fill", "red")
		.attr("width", 40)
		.attr("height", 20)	
		.attr("x", 100)
		.attr("y", 200)
		.on("mousedown", function(){sampleSVG.remove();});

	
	sampleSVG.append("text")
		.attr("x", 110)
		.attr("y", 210)
		.attr("font-size", 10)
		.text("cancel");

//animates the sequence that needs to be entered to solve puzzle

function animate_sequence(){
	if (hacking == true){return;}
	for (i=0;i<sequence.length;i++){
		j = i + 1
		sampleSVG.select("#id"+sequence[i])
			.transition()
				.duration(j*500)
				.style("fill", "lightgreen")
			.transition()
				.delay(1000)
				.style("fill", "white")

	}
	hacking = true;
}

}


