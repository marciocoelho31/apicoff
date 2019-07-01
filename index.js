require('dotenv-safe').config({
  allowEmptyValues: true
});
var jwt = require('jsonwebtoken');

var http = require('http');
const express = require('express')
//const httpProxy = require('express-http-proxy')
const app = express()
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const helmet = require('helmet');

const mysql = require('mysql');

app.use(logger('dev'));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.get('/', (req, res, next) => {
  console.log('Api funcionando...');
})

//authentication
app.post('/login', (req, res, next) => {

    if (req.body.pwd === process.env.COFF_SECRET){
      
        //auth ok
        const id = 1; //esse id viria do banco de dados
        var token = jwt.sign({ id }, process.env.SECRET, {
        expiresIn: 300 // expires in 5min
        });
        res.status(200).send({ auth: true, token: token });
    }
    else {
      res.status(500).send('Login inválido!');
    }
})

function verifyJWT(req, res, next){
  var token = req.headers['x-access-token'];
  if (!token) 
    return res.status(401).send({ auth: false, message: 'No token provided.' });
  else {
      jwt.verify(token, process.env.SECRET, function(err, decoded) {
        if (err) 
        return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
        
        // se tudo estiver ok, salva no request para uso posterior
        req.userId = decoded.id;
        next();
      });
    }
  }

  
function execSQLQuery(sqlQry, res){
  const connection = mysql.createConnection({
    host     : process.env.BDHOST,
    port     : process.env.BDPORT,
    user     : process.env.BDUSER,
    password : process.env.BDPWD,
    database : process.env.BDNAME
  });

  connection.query(sqlQry, function(error, results, fields){
      if(error) 
        res.json(error);
      else
        res.json(results);
      connection.end();
  });
}

app.get('/atendimento', verifyJWT, (req, res, next) => {

  let cliente = req.headers['sel-atend-cli'];
  let data1 = req.headers['sel-atend-dt1'] || new Date();
  let data2 = req.headers['sel-atend-dt2'] || new Date();
  let opitem = req.headers['sel-atend-opitem'];
  let pesquisa = "SELECT * FROM pendencias where not isnull(cliente)";
  if (cliente != "") {
    pesquisa += " and cliente='" + cliente + "'";
  }
  if (opitem == "1") {
    pesquisa += " and posicao='DISPONÍVEL'";
    pesquisa += " order by datapos desc"
  }
  else if (opitem == "2") {
    pesquisa += " and not isnull(prior) and prior>0 and posicao<>'DISPONÍVEL'";
    pesquisa += " order by prior"
  }
  else if (opitem == "3") {
    pesquisa += " and not isnull(prior) and prior>0 and posicao='EM ANÁLISE'";
    pesquisa += " order by datapos desc"
  }
  else if (opitem == "4") {
    pesquisa += " and not isnull(prior) and prior>0 and posicao='EM PRODUÇÃO'";
    pesquisa += " order by datapos desc"
  }
  else {
    pesquisa += " order by datapos desc"
  }
  console.log('DATA1', data1,' - DATA2', data2);

  execSQLQuery(pesquisa, res);
})

app.get('/clientes', verifyJWT, (req, res, next) => {
  let pesquisa = "SELECT * FROM clientes where autorizado='SIM'";
  execSQLQuery(pesquisa, res);
})

app.get('/clientesnome', verifyJWT, (req, res, next) => {
  execSQLQuery("SELECT nome FROM clientes order by nome", res);
})

app.get('/clientesnome', verifyJWT, (req, res, next) => {
  execSQLQuery("SELECT nome FROM clientes order by nome", res);
})

app.get('/ligacoes', verifyJWT, (req, res, next) => {
  let today = new Date();
  let date = today.getFullYear() + "-" + parseInt(today.getMonth() + 1).toString().padStart(2, '0') + "-" + today.getDate().toString().padStart(2, '0');
  execSQLQuery("SELECT * FROM rcp where data='" + date + "'", res);
})

app.get('/visitas', verifyJWT, (req, res, next) => {
  let today = new Date();
  let date = today.getFullYear() + "-" + parseInt(today.getMonth() + 1).toString().padStart(2, '0') + "-" + today.getDate().toString().padStart(2, '0');
  execSQLQuery("SELECT * FROM agenda where data='" + date + "'", res);
})

// app.get('/atendimento/:id?', verifyJWT, (req, res) =>{
//   let filter = '';
//   if(req.params.id) filter = ' WHERE ID=' + parseInt(req.params.id);
//   execSQLQuery('SELECT ' + campos + ' FROM pendencias' + filter, res);
// })

// Proxy request
var server = http.createServer(app);
var port = process.env.PORT || 3000;
//console.log('API funcionando...')
server.listen(port);