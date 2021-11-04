//===========================================================================================
//  MAPEO DE SEVERIDAD EN INCENDIOS UTILIZANDO EL INDICE NORMALIZADO DE ÁREA QUEMADA (NBR)
//===========================================================================================
//Ambito de estudio 
var geometry = "USDOS/LSIB/2017";

//*******************************************************************************************
//                                INTERVALO DE TIEMPO
// Antes del incendio
var prefire_start = '2016-12-20';   
var prefire_end = '2017-01-18';

// Despues del incendio
var postfire_start = '2017-02-20';
var postfire_end = '2017-03-28';

//*******************************************************************************************
//                            SELECCIONA UNA PLATAFORMA DE SATELITE

// Escriba los siguientes:   'L8'  o 'S2' , L8 = Landsat 8 y S2 = Sentinel 2

var platform = 'L8';    

//------------------------- Traduciendo las entradas del Usuario ----------------------------

// Imprimir plataforma satelital y fechas para la consola
if (platform == 'S2' | platform == 's2') {
  var ImCol = 'COPERNICUS/S2';
  var pl = 'Sentinel-2';
} else {
  var ImCol = 'LANDSAT/LC08/C01/T1_SR';
  var pl = 'Landsat 8';
}
print(ee.String('Plataforma seleccionado para el análisis: ').cat(pl));
print(ee.String('Fecha ocurrido del incendio entre ').cat(prefire_end).cat(' y ').cat(postfire_start));

// Localización
var area = ee.FeatureCollection(geometry2)

                
Map.centerObject(area);

//------------------- Selecciona coleciones de imagenes por tiempo y ubicación --------------------

var imagery = ee.ImageCollection(ImCol);


// Antes del incendio
var prefireImCol = ee.ImageCollection(imagery
    .filterDate(prefire_start, prefire_end)
    .filterBounds(area));
    
// Despues del incendio
var postfireImCol = ee.ImageCollection(imagery
    .filterDate(postfire_start, postfire_end)
    .filterBounds(area));

print("Colección de imágenes pre-incendio: ", prefireImCol); 
print("Colección de imágenes post-incendio: ", postfireImCol);

//--------------------------- Aplicar una máscara de nubes y nieve --------------------------

// Función para enmascarar nubes a partir de la banda de calidad de píxeles de los datos de 
// la plataforma Sentinel-2 SR.
function maskS2sr(image) {
  // Los bits 10 y 11 son nubes y cirros, respectivamente.
  var cloudBitMask = ee.Number(2).pow(10).int();
  var cirrusBitMask = ee.Number(2).pow(11).int();
  // Obtenga la banda QA de control de calidad de píxeles.
  var qa = image.select('QA60');
  // Todos los indicadores deben establecerse en cero, lo que indica condiciones limpias o 
  // libres de nubes.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  // Devuelve la imagen enmascarada y escalada a la reflectancia TOA, sin las bandas de QA.
  return image.updateMask(mask)
      .copyProperties(image, ["system:time_start"]);
}

// Función para enmascarar nubes de la banda de calidad de píxeles de los datos de la 
// plataforma Landsat 8 SR.
function maskL8sr(image) {
  // Los bits 3 y 5 son nubes y sombras de nubes, respectivamente.
  var cloudShadowBitMask = 1 << 3;
  var cloudsBitMask = 1 << 5;
  var snowBitMask = 1 << 4;
  // Obtenga la banda de control de calidad de píxeles.
  var qa = image.select('pixel_qa');
  // Todos los indicadores deben establecerse en cero, lo que indica condiciones claras o
  // libres de nubes.
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
      .and(qa.bitwiseAnd(cloudsBitMask).eq(0))
      .and(qa.bitwiseAnd(snowBitMask).eq(0));
  // Devuelva la imagen enmascarada y escalada a la reflectancia TOA, sin las bandas de QA.
  return image.updateMask(mask)
      .select("B[0-9]*")
      .copyProperties(image, ["system:time_start"]);
}

// Aplicar máscara de nube 
if (platform == 'S2' | platform == 's2') {
  var prefire_CM_ImCol = prefireImCol.map(maskS2sr);
  var postfire_CM_ImCol = postfireImCol.map(maskS2sr);
} else {
  var prefire_CM_ImCol = prefireImCol.map(maskL8sr);
  var postfire_CM_ImCol = postfireImCol.map(maskL8sr);
}

//---------------- Reduccion y recorte de imágenes para el ambito de estudio--------------------

var pre_mos = prefireImCol.median().clip(area);
var post_mos = postfireImCol.median().clip(area);

var pre_cm_mos = prefire_CM_ImCol.median().clip(area);
var post_cm_mos = postfire_CM_ImCol.median().clip(area);

// Agregue las imágenes recortadas a la consola de la derecha
print("Imagen en color verdadero previa al incendio: ", pre_mos); 
print("Imagen en color verdadero posterior al incendio: ", post_mos);

//------------ Calcular el NBR para imágenes de las plataformas --------------

// Aplicar el NBR = (NIR-SWIR2) / (NIR+SWIR2)
if (platform == 'S2' | platform == 's2') {
  var preNBR = pre_cm_mos.normalizedDifference(['B8', 'B12']);
  var postNBR = post_cm_mos.normalizedDifference(['B8', 'B12']);
} else {
  var preNBR = pre_cm_mos.normalizedDifference(['B5', 'B7']);
  var postNBR = post_cm_mos.normalizedDifference(['B5', 'B7']);
}

// Agregua las imágenes NBR a la consola a la derecha
 print ("Índice de Área Quemada previa al fuego:", preNBR);
 print ("Índice de Área Quemada posterior al incendio:", postNBR);

//---------- Calcular la diferencia entre imágenes antes y despues al incendio --------

// Diferencial dNBR
var dNBR_unscaled = preNBR.subtract(postNBR);
print(dNBR_unscaled);
// Escale el producto a los estándares del USGS (FIREMON)
var dNBR = dNBR_unscaled.multiply(1000);
print(dNBR);

//==========================================================================================
//                                 AGREGAR CAPAS AL MAPA

// Añadir el límite.
Map.addLayer(area.style( {
  fillColor: 'b5ffb4',
  color: '00909F',
  width: 1.0,
}), {},'Área de estudio');

//----------------------------- Imágenes en color verdadero --------------------------------

// Aplicar parámetros de visualización específicos de la plataforma para imágenes en color 
// verdadero.
if (platform == 'S2' | platform == 's2') {
  var vis = {bands: ['B4', 'B3', 'B2'], max: 2000, gamma: 1.5};
} else {
  var vis = {bands: ['B4', 'B3', 'B2'], min: 0, max: 4000, gamma: 1.5};
}

// Agregua las imágenes en color verdadero al mapa.
Map.addLayer(pre_mos, vis,'Imagen previa al incendio');
Map.addLayer(post_mos, vis,'Imagen posterior al incendio');

// Agregua las imágenes con mascara de nubes en color verdadero al mapa.
Map.addLayer(pre_cm_mos, vis,'Imagen previa al incendio: con mascara de nubes');
Map.addLayer(post_cm_mos, vis,'Imagen posterior al incendio: con mascara de nubes');

//------------------- Producto de area quemada - En escala de grises ------------------------

var grey = ['white', 'black'];

Map.addLayer(dNBR, {min: -1000, max: 1000, palette: grey}, 'dNBR en escala de grises');

//----------------- Producto de severidad del incendio - Clasificación ----------------------

// Define un estilo SLD de intervalos discretos para aplicar a la imagen (paleta de color).
var sld_intervals =
  '<RasterSymbolizer>' +
    '<ColorMap type="intervals" extended="false" >' +
      '<ColorMapEntry color="#ffffff" quantity="-500" label="-500"/>' +
      '<ColorMapEntry color="#7a8737" quantity="-250" label="-250" />' +
      '<ColorMapEntry color="#acbe4d" quantity="-100" label="-100" />' +
      '<ColorMapEntry color="#0ae042" quantity="100" label="100" />' +
      '<ColorMapEntry color="#fff70b" quantity="270" label="270" />' +
      '<ColorMapEntry color="#ffaf38" quantity="440" label="440" />' +
      '<ColorMapEntry color="#ff641b" quantity="660" label="660" />' +
      '<ColorMapEntry color="#FF0000" quantity="2000" label="2000" />' +
    '</ColorMap>' +
  '</RasterSymbolizer>';

// Agregua la imagen al mapa utilizando la rampa de color como los intervalo definidos.
Map.addLayer(dNBR.sldStyle(sld_intervals), {}, 'dNBR clasificado');

// Separa el resultado en 8 clases de severidad del incendio.
var thresholds = ee.Image([-1000, -251, -101, 99, 269, 439, 659, 2000]);
var classified = dNBR.lt(thresholds).reduce('sum').toInt();

//==========================================================================================
//                          AGREGAR ESTADÍSTICAS DE ÁREA QUEMADA

// cunta el número de píxeles en toda la capa.
var allpix =  classified.updateMask(classified);  // enmascara toda la capa
var pixstats = allpix.reduceRegion({
  reducer: ee.Reducer.count(),               // cuenta píxeles en una sola clase
  geometry: area,
  scale: 30
  });
var allpixels = ee.Number(pixstats.get('sum')); // extrae el recuento de píxeles como un número


// crea una lista vacía para almacenar los valores en área
var arealist = [];

// crea una función para derivar el alcance de una clase de severidad del incendio
// los argumentos son número de clase y nombre de clase
var areacount = function(cnr, name) {
 var singleMask =  classified.updateMask(classified.eq(cnr));  // enmascara una sola clase
 var stats = singleMask.reduceRegion({
  reducer: ee.Reducer.count(),               // cuenta los píxeles en una sola clase
  geometry: area,
  scale: 30
  });
var pix =  ee.Number(stats.get('sum'));
var hect = pix.multiply(900).divide(10000);                // Pixel Landsat = 30m x 30m -> 900 m2
var perc = pix.divide(allpixels).multiply(10000).round().divide(100);   // obtiene el % de área por clase y redondea a 2 decimales
arealist.push({Class: name, Pixels: pix, Hectares: hect, Percentage: perc});
};

// clases de severidad en orden ascendente.
var names2 = ['NA', 'Alta Severidad', 'Moderada/alta Severidad',
'Moderada/baja Severidad', 'Baja Severidad','No quemado', 'Nuevo rebrote, Bajo', 'Nuevo rebrote, Alto'];

// ejecuta la función para cada clase
for (var i = 0; i < 8; i++) {
  areacount(i, names2[i]);
  }

print('Área quemada por clase de Severidad', arealist, '--> haga clic en la lista de objetos para ver las clases individuales');

//==========================================================================================
//                                    AGREGAR UNA LEYENDA

// establece la posición del recuadro de leyenda.
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }});
 
// Crea un título de leyenda.
var legendTitle = ui.Label({
  value: 'Clases del dNBR',
  style: {fontWeight: 'bold',
    fontSize: '18px',
    margin: '0 0 4px 0',
    padding: '0'
    }});
 
// Agregua el título al recuadro.
legend.add(legendTitle);
 
// Crea y estiliza 1 fila de la leyenda.
var makeRow = function(color, name) {
 
      // Crea la etiqueta que en realidad es el cuadro de color.
      var colorBox = ui.Label({
        style: {
          backgroundColor: '#' + color,
          // Usa (padding) para rellenoar y dar la altura y el ancho de la caja.
          padding: '8px',
          margin: '0 0 4px 0'
        }});
 
      // Crea la etiqueta llena con el texto descriptivo.
      var description = ui.Label({
        value: name,
        style: {margin: '0 0 4px 6px'}
      });
 
      // devuelve el panel
      return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
      })};
 
//  Paleta de colores
var palette =['7a8737', 'acbe4d', '0ae042', 'fff70b', 'ffaf38', 'ff641b', 'FF0000', 'ffffff'];
 
// Nombre de la leyenda
var names = ['Nuevo rebrote, Alto','Nuevo rebrote, Bajo','No quemado', 'Baja Severidad',
'Moderda-Baja Severidad', 'Moderada-Alta Severidad', 'Alta Severidad', 'NA'];
 
// Agregua color y nombres
for (var i = 0; i < 8; i++) {
  legend.add(makeRow(palette[i], names[i]));
  }  
 
// Agrega la leyenda al mapa (también se puede imprimir la leyenda en la consola)
//Map.add(legend);
ui.root.add(legend)
//==========================================================================================
//                                PREPARAR EL ARCHIVO A EXPORTAR

var id = dNBR.id().getInfo();
print(id)     
Export.image.toDrive({image: dNBR, scale: 30, description: id, fileNamePrefix: 'dNBR',
  region: area, maxPixels: 1e10});
