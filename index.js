require('dotenv-safe').config({
  allowEmptyValues: true
});
var jwt = require('jsonwebtoken');

var http = require('http');
const express = require('express')
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

app.post('/login', (req, res, next) => {

    if (req.body.pwd === process.env.COFF_SECRET){
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
  let data1 = req.headers['sel-atend-dt1'] || '';
  let data2 = req.headers['sel-atend-dt2'] || '';
  let opitem = req.headers['sel-atend-opitem'];

  if (data1 == '' && data2 != '') {
    ddata1 = new Date();
    data1 = ddata1.getFullYear() + "-" + parseInt(ddata1.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata1.getDate().toString().padStart(2, "0");
  }
  else if (data2 == '' && data1 != '') {
    ddata2 = new Date();
    data2 = ddata2.getFullYear() + "-" + parseInt(ddata2.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata2.getDate().toString().padStart(2, "0");
  }

  let pesquisa = "SELECT * FROM pendencias where not isnull(cliente)";
  if (cliente != "") {
    pesquisa += " and cliente='" + cliente + "'";
  }
  if (opitem == "1") {
    if (data1 != '' && data2 != '') {
      pesquisa += " and not isnull(datapos) and datapos>='" + data1.substr(0, 10) + "' and datapos<='" + data2.substr(0, 10) + "'";
    }
    pesquisa += " and posicao='DISPONÍVEL'";
    pesquisa += " order by datapos desc";
  }
  else if (opitem == "2") {
    pesquisa += " and not isnull(prior) and prior>0 and posicao<>'DISPONÍVEL'";
    pesquisa += " order by prior";
  }
  else if (opitem == "3") {
    pesquisa += " and not isnull(prior) and prior>0 and posicao='EM ANÁLISE'";
    if (data1 != '' && data2 != '') {
      pesquisa += " and not isnull(datasolic) and datasolic>='" + data1.substr(0, 10) + "' and datasolic<='" + data2.substr(0, 10) + "'";
    }
    pesquisa += " order by prior";
  }
  else if (opitem == "4") {
    pesquisa += " and not isnull(prior) and prior>0 and posicao='EM PRODUÇÃO'";
    if (data1 != '' && data2 != '') {
      pesquisa += " and not isnull(datasolic) and datasolic>='" + data1.substr(0, 10) + "' and datasolic<='" + data2.substr(0, 10) + "'";
    }
    pesquisa += " order by prior";
  }
  else {
    if (data1 != '' && data2 != '') {
      pesquisa += " and not isnull(datapos) and datapos>='" + data1.substr(0, 10) + "' and datapos<='" + data2.substr(0, 10) + "'";
    }
    pesquisa += " order by datapos desc";
  }

  execSQLQuery(pesquisa, res);
})

app.get('/atendimento/maxprior', verifyJWT, (req, res, next) => {
  let pesquisa = "SELECT max(prior) as prior FROM pendencias";
  execSQLQuery(pesquisa, res);
})

app.get('/clientes', verifyJWT, (req, res, next) => {
  let sistema = req.headers['sel-cli-sist'];
  let cidade = req.headers['sel-cli-cid'];
  let estado = req.headers['sel-cli-est'];
  let opaut = req.headers['sel-cli-aut'];
  let opcobr = req.headers['sel-cli-cobr'];

  let pesquisa = "SELECT nome FROM clientes where not isnull(nome)";
  if (sistema != "") {
    pesquisa += " and sistema='" + sistema + "'";
  }
  if (cidade != "") {
    pesquisa += " and cidade='" + cidade + "'";
  }
  if (estado != "") {
    pesquisa += " and estado='" + estado + "'";
  }
  if (opaut == "1") {
    pesquisa += " and not isnull(autorizado) and autorizado='SIM'"
  }
  else if (opaut == "2") {
    pesquisa += " and not isnull(autorizado) and autorizado='NÃO'"
  }
  if (opcobr == "1") {
    pesquisa += " and not isnull(cobranca) and cobranca='S'"
  }
  else if (opcobr == "2") {
    pesquisa += " and not isnull(cobranca) and cobranca='N'"
  }
  pesquisa += " order by nome";

  execSQLQuery(pesquisa, res);
})

app.get('/clientesnome', verifyJWT, (req, res, next) => {
  execSQLQuery("SELECT nome FROM clientes order by nome", res);
})

app.get('/clientes/sistemas', verifyJWT, (req, res, next) => {
  execSQLQuery("SELECT distinct sistema FROM clientes order by sistema", res);
})

app.get('/clientes/cidades', verifyJWT, (req, res, next) => {
  execSQLQuery("SELECT distinct cidade FROM clientes order by cidade", res);
})

app.get('/clientes/estados', verifyJWT, (req, res, next) => {
  execSQLQuery("SELECT distinct estado FROM clientes order by estado", res);
})

app.get('/ligacoes', verifyJWT, (req, res, next) => {
  let cliente = req.headers['sel-lig-cli'];
  let data1 = req.headers['sel-lig-dt1'] || '';
  let data2 = req.headers['sel-lig-dt2'] || '';

  if (data1 == '' && data2 != '') {
    ddata1 = new Date();
    data1 = ddata1.getFullYear() + "-" + parseInt(ddata1.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata1.getDate().toString().padStart(2, "0");
  }
  else if (data2 == '' && data1 != '') {
    ddata2 = new Date();
    data2 = ddata2.getFullYear() + "-" + parseInt(ddata2.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata2.getDate().toString().padStart(2, "0");
  }
  else if (data1 == '' && data2 == '') {
    ddata1 = new Date();
    data1 = ddata1.getFullYear() + "-" + parseInt(ddata1.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata1.getDate().toString().padStart(2, "0");
    ddata2 = new Date();
    data2 = ddata2.getFullYear() + "-" + parseInt(ddata2.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata2.getDate().toString().padStart(2, "0");
  }

  let pesquisa = "SELECT * FROM rcp where not isnull(local)";
  if (cliente != "") {
    pesquisa += " and local='" + cliente + "'";
  }
  if (data1 != '' && data2 != '') {
    pesquisa += " and not isnull(data) and data>='" + data1.substr(0, 10) + "' and data<='" + data2.substr(0, 10) + "'";
  }
  pesquisa += " order by data desc";

  execSQLQuery(pesquisa, res);
})

app.get('/visitas', verifyJWT, (req, res, next) => {
  let cliente = req.headers['sel-vis-cli'];
  let data1 = req.headers['sel-vis-dt1'] || '';
  let data2 = req.headers['sel-vis-dt2'] || '';

  if (data1 == '' && data2 != '') {
    ddata1 = new Date();
    data1 = ddata1.getFullYear() + "-" + parseInt(ddata1.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata1.getDate().toString().padStart(2, "0");
  }
  else if (data2 == '' && data1 != '') {
    ddata2 = new Date();
    data2 = ddata2.getFullYear() + "-" + parseInt(ddata2.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata2.getDate().toString().padStart(2, "0");
  }
  else if (data1 == '' && data2 == '') {
    ddata1 = new Date();
    data1 = ddata1.getFullYear() + "-" + parseInt(ddata1.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata1.getDate().toString().padStart(2, "0");
    ddata2 = new Date();
    data2 = ddata2.getFullYear() + "-" + parseInt(ddata2.getMonth() + 1).toString().padStart(2, "0") + "-" + ddata2.getDate().toString().padStart(2, "0");
  }

  let pesquisa = "SELECT * FROM agenda where not isnull(local)";
  if (cliente != "") {
    pesquisa += " and local='" + cliente + "'";
  }
  if (data1 != '' && data2 != '') {
    pesquisa += " and not isnull(data) and data>='" + data1.substr(0, 10) + "' and data<='" + data2.substr(0, 10) + "'";
  }
  pesquisa += " order by data desc";

  execSQLQuery(pesquisa, res);
})

// app.get('/atendimento/:id?', verifyJWT, (req, res) =>{
//   let filter = '';
//   if(req.params.id) filter = ' WHERE ID=' + parseInt(req.params.id);
//   execSQLQuery('SELECT ' + campos + ' FROM pendencias' + filter, res);
// })

// Proxy request
var server = http.createServer(app);
var port = process.env.PORT || 3000;
server.listen(port);