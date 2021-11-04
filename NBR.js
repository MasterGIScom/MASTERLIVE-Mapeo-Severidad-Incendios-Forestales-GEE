//Visualizacion permanente del satelite con sus etiquetas 
Map.setOptions('HYBRID');

//Collecion de imagenes Landsat 
var colec_land8 =  ee.ImageCollection("LANDSAT/LC08/C01/T1_TOA")
                   .filterBounds(geometry)
                   .filterDate('2020-01-01', '2020-05-20')
                   .filterMetadata('CLOUD_COVER', 'less_than', 5);
print('Coleccion de imagenes:', colec_land8);

//Imagen landsat 8 2020
var img_20 = ee.Image('LANDSAT/LC08/C01/T1_TOA/LC08_093077_20200427');

//Visualizar 
Map.addLayer(img_20, {min: 0, max: 0.5, bands: ['B6', 'B5','B4']}, 'Imagen 2020');

//=============== Claculo de la  índice normalizado de área quemada (NBR) ==================
// (NIR-SWIR)/(NIR+SWIR)
//El análisis de severidad de incendios a través del índice NBR (Normalized Burn Ratio) 
//es una de las vías que podremos desempeñar durante los análisis de imágenes satélite 
//con el fin de evaluar daños forestales o analizar la evolución de la regeneración de la
//cubierta vegetal tras un incendio.

//primera forma
var NBR = img_20.select('B5').subtract(img_20.select('B7')).divide(img_20.select('B5').add(img_20.select('B7')));
//Segunda forma
var NBR2 = img_20.normalizedDifference(['B5', 'B7']);

//Parametros de visualizacion 
var vispara = {
  min:0.0,
  max:1, 
  palette: ['#7F0010', '#D99143', '#C04529', '#E02E20', '#EC6521', '#F6D53B']};
  
//Visualizacion en el mapa

Map.addLayer(NBR, vispara,  'NBR', true);
Map.addLayer(NBR2, vispara, 'NBR2', true);


