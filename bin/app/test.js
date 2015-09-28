// Load the http module to create an http server.
var http = require('http');
var fs = require('fs');

// Configure our HTTP server to respond with Hello World to all requests.
var server = http.createServer(function (request, response) {

  var filePath = request.url;
  console.log(filePath);
  
  if(filePath == '/temp_name.js'){
    console.log('equal temp');
    fs.readFile('temp_name.js', function(err, data){
      response.writeHead(200, {"Content-Type": "application/javascript"});
      response.write(data );
      response.end();
    });
  } else if(filePath == '/dist/css/bootstrap.min.css'){
    console.log('css');
    fs.readFile('/dist/css/bootstrap.min.css', function(err, data){
      response.writeHead(200, {"Content-Type": "text/css"});
      response.write(data);
      response.end();
    });
  } else if(filePath == '/embed1'){
    console.log('equal 1');
    fs.readFile('embed1.html', function(err, data){
      response.write(data);
      response.end();
    });
  }else if(filePath == '/embed2'){
    console.log('equal 2');
    fs.readFile('embed2.html', function(err, data){
      response.write(data);
      response.end();
    });
  }else if(filePath == '/embed3'){
    console.log('equal 3');
    fs.readFile('embed3.json', function(err, data){
      response.writeHead(200, {"Content-Type": "application/json", "X-FS-TL": "http://127.0.0.1:6661/temp_name.js", "X-FS-Template-Keys":"__default__=demo"});
      response.write(data);
      response.end();
    });
  } else {
    console.log('not equal');
    fs.readFile('test.html', function(err, data){
      response.writeHead(200, {"Content-Type": "text/html", "X-FS-Page-Parse": "1"});
      response.write(data);
      response.end();
    });
  }
});

// Listen on port 8000, IP defaults to 127.0.0.1
server.listen(4000);

// Put a friendly message on the terminal
console.log("Server running at http://127.0.0.1:4000/");
