// curl -k https://localhost:8000/
var https = require('https');
var fs = require('fs');

var options = {
  key: fs.readFileSync('cert/key.pem'),
  cert: fs.readFileSync('cert/cert.pem')
};

https.createServer(options, function (request, response) {
  var filePath = request.url;
  console.log(filePath);
  if(filePath == '/dist/js/fz.js'){
    console.log('js');
    fs.readFile('./dist/js/fz.js', function(err, data){
      response.write(data);
      response.end();
    });
  } else {
    response.writeHead(200);
    response.end("fuck\n");
  }
}).listen(8000);
