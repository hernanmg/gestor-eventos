// Catálogo de ítems de los 5 remitos físicos de DOS57, tal como figuran en las
// planillas Excel originales. El PDF imprime SIEMPRE todos los ítems del tipo
// (los no cargados quedan con línea en blanco para completar a mano), así que
// el orden de este archivo es el orden impreso.
//
// Identidad de un ítem: `codigo` cuando existe, si no `descripcion`. Ojo que
// dentro de un mismo tipo puede haber códigos repetidos entre categorías
// (no los hay hoy) — claveItemRemito() incluye la descripción para no colisionar.

export type TipoRemitoCatalogo = 'LAYHER' | 'NACIONAL' | 'TECHOS' | 'PANOL' | 'LONAS_AFORO';

export interface ItemCatalogoRemito { codigo?: string; descripcion: string }
export interface CategoriaRemito    { categoria: string; items: ItemCatalogoRemito[] }

export interface TipoRemitoInfo {
  tipo:       TipoRemitoCatalogo;
  nombre:     string;  // "Layher", "Pañol"...
  titulo:     string;  // lo que va en el PDF: "LAYHER", "PAÑOL"...
  conCodigo:  boolean; // columna CÓDIGO en la tabla
  categorias: CategoriaRemito[];
}

export const claveItemRemito = (i: { codigo?: string | null; descripcion: string }) =>
  `${i.codigo ?? ''}|${i.descripcion}`;

const LAYHER: CategoriaRemito[] = [
  { categoria: 'BASES', items: [
    { codigo: '4001040.0', descripcion: 'ZB Base Regulable 0.40m' },
    { codigo: '4001060.0', descripcion: 'ZB Base Regulable 0.60m' },
    { codigo: '4003000.0', descripcion: 'ZB Base p/ Superficies Inclinadas' },
    { codigo: '2602000.0', descripcion: 'AR Base Collarín' },
    { codigo: '2303000.0', descripcion: 'Rigidizador Vertical' },
  ]},
  { categoria: 'VERTICALES', items: [
    { codigo: '2604050.0', descripcion: 'AR Vertical 0.50m s/e' },
    { codigo: '2604100.0', descripcion: 'AR Vertical 1.00m s/e' },
    { codigo: '2604150.0', descripcion: 'AR Vertical 1.50m s/e' },
    { codigo: '2604200.0', descripcion: 'AR Vertical 2.00m s/e' },
    { codigo: '2617050.0', descripcion: 'AR Vertical LW 0.50m c/e' },
    { codigo: '2617100.0', descripcion: 'AR Vertical LW 1.00m c/e' },
    { codigo: '2617150.0', descripcion: 'AR Vertical LW 1.50m c/e' },
    { codigo: '2617200.0', descripcion: 'AR Vertical LW 2.00m c/e' },
  ]},
  { categoria: 'HORIZONTALES', items: [
    { codigo: '2601073.0', descripcion: 'AR O-Horizontal LW 0.73m' },
    { codigo: '2601109.0', descripcion: 'AR O-Horizontal LW 1.09m' },
    { codigo: '2601157.0', descripcion: 'AR O-Horizontal LW 1.57m' },
    { codigo: '2601257.0', descripcion: 'AR O-Horizontal LW 2.57m' },
    { codigo: '2601307.0', descripcion: 'AR O-Horizontal LW 3.07m' },
    { codigo: '2678257.0', descripcion: 'Horizontal Diagonal Planta LW 2.57x2.57m' },
  ]},
  { categoria: 'VIGAS PUENTE', items: [
    { codigo: '2618073.0', descripcion: 'AR U-Horizontal LW 0.73m' },
    { codigo: '2618109.0', descripcion: 'AR U-Horizontal LW 1.09m' },
    { codigo: '2618157.0', descripcion: 'AR U-Horizontal LW 1.57m Reforzada T14' },
    { codigo: '2618257.0', descripcion: 'AR U-Horizontal LW 2.57m Reforzada T14' },
    { codigo: '2618307.0', descripcion: 'AR U-Horizontal LW 3.07m Reforzada T14' },
  ]},
  { categoria: 'MÉNSULAS', items: [
    { codigo: '2632109.0', descripcion: 'AR U-Ménsula LW 1.09m' },
    { codigo: '2632039.0', descripcion: 'AR U-Ménsula LW 0.39m' },
    { codigo: '2632073.0', descripcion: 'AR U-Ménsula LW 0.73m' },
  ]},
  { categoria: 'ESPIGAS', items: [
    { codigo: '2656002.0', descripcion: 'AR Espiga p/ Viga U Reforzada' },
    { codigo: '4706022.0', descripcion: 'Espiga c/ Media Grapa' },
    { codigo: '4916000.0', descripcion: 'Espiga Union' },
  ]},
  { categoria: 'DIAGONALES', items: [
    { codigo: '2683073.0', descripcion: 'AR Diagonal LW 0.73 x 2.00m' },
    { codigo: '2683109.0', descripcion: 'AR Diagonal LW 1.09 x 2.00m' },
    { codigo: '2681157.0', descripcion: 'AR Diagonal LW 1.57 x 1.00m' },
    { codigo: '2683157.0', descripcion: 'AR Diagonal LW 1.57 x 2.00m' },
    { codigo: '2680257.0', descripcion: 'AR Diagonal LW 2.57 x 0.50m' },
    { codigo: '2681257.0', descripcion: 'AR Diagonal LW 2.57 x 1.00m' },
    { codigo: '2682257.0', descripcion: 'AR Diagonal LW 2.57 x 1.50m' },
    { codigo: '2683257.0', descripcion: 'AR Diagonal LW 2.57 x 2.00m' },
  ]},
  { categoria: 'ESCALERAS', items: [
    { codigo: '1753257.0', descripcion: 'BL Escalera Aluminio c/ Descanso 2.57m' },
    { codigo: '2639002.0', descripcion: 'AR U-Wange LW 750 2 Peldaños' },
    { codigo: '2639003.0', descripcion: '0.70 Lahyer Wange 3 Peldaños' },
    { codigo: '2639005.0', descripcion: 'AR U-Wange LW 750 5 Peldaños 1.57x1.00m' },
    { codigo: '2639008.0', descripcion: 'AR U-Wange LW 750 8 Peldaños 2.57x1.50m' },
    { codigo: '2639009.0', descripcion: 'AR U-Wange LW 750 9 Peldaños 2.57x2.00m' },
  ]},
  { categoria: 'CELOSÍAS', items: [
    { codigo: '2674257.0', descripcion: 'AR O-Viga Celosía LW 2.57x0.50m' },
    { codigo: '2674514.0', descripcion: 'AR O-Viga Celosía LW 5.14x0.50m' },
    { codigo: '2674771.0', descripcion: 'AR O-Viga Celosía LW 7.71x0.50m' },
    { codigo: '2673257.0', descripcion: 'AR U-Viga Celosía LW 2.57x0.50m' },
  ]},
  { categoria: 'PISOS RAYADORES', items: [
    { codigo: '3801257.0', descripcion: 'BE U-Plataforma Acero 2,57 x 0,19' },
    { codigo: '3883073.0', descripcion: 'BE U-Plataforma Acero LW 0,73 x 0,32' },
    { codigo: '3883109.0', descripcion: 'BE U-Plataforma Acero LW 1,09 x 0,32' },
    { codigo: '3883157.0', descripcion: 'BE U-Plataforma Acero LW 1,57 x 0,32' },
    { codigo: '3883257.0', descripcion: 'BE U-Plataforma Acero LW 2,57 x 0,32' },
  ]},
  { categoria: 'OTROS', items: [
    { codigo: '4777022.0', descripcion: 'KP Grapa Ortogonal Rosca Gruesa 0.22m' },
    { codigo: '4778022.0', descripcion: 'KP Grapa Giratoria Rosca Gruesa 0.22m' },
    { codigo: '2629000.0', descripcion: 'AR Doble Cabeza Allround LW' },
  ]},
];

const NACIONAL: CategoriaRemito[] = [
  { categoria: 'STRINGER', items: [
    { descripcion: 'Stringer 1,09' },
    { descripcion: 'Stringer 1,57' },
    { descripcion: 'Stringer 2,57' },
    { descripcion: 'Stringer Doble' },
    { descripcion: 'Stringer Para Rampa' },
  ]},
  { categoria: 'RECORTES Y FAJAS DE FENÓLICO', items: [
    { descripcion: 'Placa de Fenólico - Taco de Madera 30 X 30' },
    { descripcion: 'Placa de Fenólico - Taco de Madera 40 X 40' },
    { descripcion: 'Placa de Fenólico - Taco de Madera 60 x 60' },
    { descripcion: 'Placa de Fenólico - Faja 10 X 2,44' },
    { descripcion: 'Placa de Fenólico - Faja 20 X 2,44' },
    { descripcion: 'Placa de Fenólico - Faja 30 X 2,44' },
    { descripcion: 'Placa de Fenólico - Faja 40 X 2,44' },
    { descripcion: 'Placa de Fenólico - Faja 60 X 2,44' },
    { descripcion: 'Placa de Fenólico - Faja 80 X 2,45' },
  ]},
  { categoria: 'PLACAS DE FENÓLICO', items: [
    { descripcion: 'Placa de Fenólico A' },
    { descripcion: 'Placa de Fenólico B' },
    { descripcion: 'Placa de Fenólico C' },
  ]},
  { categoria: 'MDF', items: [
    { descripcion: 'Placa de MDF (5mm)' },
    { descripcion: 'Placa de MDF (9mm)' },
  ]},
  { categoria: 'RECORTES DE CHAPA', items: [
    { descripcion: 'Chapas Recorte 0,30 x 0,30' },
    { descripcion: 'Chapas Recorte 0,30 x 0,73' },
    { descripcion: 'Chapas Recorte 0,30 x 1,09' },
    { descripcion: 'Chapas Recorte 0,30 x 1,57' },
    { descripcion: 'Chapas Recorte 0,30 x 2,44' },
  ]},
  { categoria: 'VALLAS', items: [
    { descripcion: 'Vallas Dos57' },
    { descripcion: 'Vallas Livianas' },
    { descripcion: 'Vallas Pesadas' },
  ]},
  { categoria: 'HORIZONTALES', items: [
    { descripcion: 'Horizontal Planta 0,73' },
    { descripcion: 'Horizontal Planta 1,09' },
    { descripcion: 'Planta horizontal 1,57' },
  ]},
  { categoria: 'CELOSÍAS', items: [
    { descripcion: 'Celosia 1,57' },
  ]},
  { categoria: 'ESCALERAS', items: [
    { descripcion: 'Escalera de Madera - 4 Peldaños - 1' },
    { descripcion: 'Escalera de Madera - 2 Peldaños - 0,70 y 0,50' },
    { descripcion: 'Escalera de Madera - 1 Peldaño - 0,25' },
    { descripcion: 'Escalon Madera - 0,73 x 0,32' },
    { descripcion: 'Escalon Chapa - 1,09 x 0,32' },
  ]},
  { categoria: 'TARIMAS', items: [
    { descripcion: 'Tarima 2,44 x 0,60 x 0,15' },
    { descripcion: 'Tarima 2,44 x 1,22 x 0,30' },
    { descripcion: 'Tarima 2 x 1,22 x 0,30' },
  ]},
  { categoria: 'CERRAMIENTO DE CHAPA', items: [
    { descripcion: 'Placa de Cerramiento de Chapa 2m' },
    { descripcion: 'Portones Cerramiento de Chapa' },
    { descripcion: 'W para Cerramiento' },
    { descripcion: 'Pie de Chapa' },
    { descripcion: 'Bulones para Cerramiento' },
    { descripcion: 'Adoquin de Cemento' },
    { descripcion: 'Diagonales de Cerramiento' },
  ]},
  { categoria: 'FREESTANDING', items: [
    { descripcion: 'Placa de Freestanding' },
    { descripcion: 'Esquinero de Freestanding' },
    { descripcion: 'Rejas Planas Freestanding' },
  ]},
  { categoria: 'IPN', items: [
    { descripcion: 'IPN 10 - 2,60' },
    { descripcion: 'IPN 10 - 3,30' },
    { descripcion: 'IPN 12 - 2,60' },
    { descripcion: 'IPN 12 - 3,60' },
    { descripcion: 'IPN 14 - 2,60' },
    { descripcion: 'IPN 14 - 4' },
    { descripcion: 'IPN 16 - 2,60' },
    { descripcion: 'IPN 16 Izaje - 3,60' },
    { descripcion: 'IPN 20 - 2,60' },
  ]},
  { categoria: 'CONTRAPESOS', items: [
    { descripcion: 'Contrapeso con Arena' },
    { descripcion: 'Contrapeso para Agua' },
    { descripcion: 'Contrapeso de Cemento' },
  ]},
  { categoria: 'OTROS', items: [
    { descripcion: 'Colitas de Chancho' },
    { descripcion: 'Pieza 0.36' },
  ]},
];

const TECHOS: CategoriaRemito[] = [
  { categoria: 'TECHO LAYHER CASSETTE', items: [
    { codigo: '2504257.0', descripcion: 'Tubo Transversal 2,57 p/ Cubierta' },
    { codigo: '4600150.0', descripcion: 'Tubo Acero Galvanizado 48,3mm x 4mm x1.50m' },
    { codigo: '4600200.0', descripcion: 'Tubo Acero Galvanizado 48,3mm x 4mm x 2,00m' },
    { codigo: '4700022.0', descripcion: 'Grapa Ortogonal 0,22m' },
    { codigo: '4702022.0', descripcion: 'Grapa Giratoria 0,22m' },
    { codigo: '4905002.0', descripcion: 'GI Pasador Seguridad 2,8mm' },
    { codigo: '4905062.0', descripcion: 'GI Tornillo M12x60 c/ Tuerca p/ Espiga Vertical' },
    { codigo: '4908067.0', descripcion: 'GI Tornillo M14x65 c/ Tuerca p/ Espiga Tirante' },
    { codigo: '4916000.0', descripcion: 'Espiga Unión 4906 Cub./ Vigas' },
    { codigo: '4925000.0', descripcion: 'GI Viga Celosía Acero T16' },
    { codigo: '4925325.0', descripcion: 'Viga Celosía Acero 450 LW 8,45 X 3,25m' },
    { codigo: '4925532.0', descripcion: 'Viga Celosía Acero 450 LW 8,45 X 5,32m' },
    { codigo: '5901000.0', descripcion: 'HA IH Viga Dos Aguas Cubierta Cass' },
    { codigo: '5902200.0', descripcion: 'HA IH Viga de Cubierta 2,00m' },
    { codigo: '5902300.0', descripcion: 'HA IH Viga de Cubierta 3,00m' },
    { codigo: '5903002.0', descripcion: 'HA IH Bulón 30x50mm' },
    { codigo: '5904002.0', descripcion: 'HA IH Bulón 30x54mm' },
    { codigo: '5905002.0', descripcion: 'HA IH Pasador Seguridad 4mm' },
    { codigo: '5906079.0', descripcion: 'HA IH Bulón 14x77mm' },
    { codigo: '5906109.0', descripcion: 'HA IH Bulón 14x107mm' },
    { codigo: '5907000.0', descripcion: 'HA IH Viga Celosia de Unión 2,57m' },
    { codigo: '5909100.0', descripcion: 'HA IH Chapa 1,00 x 2,57m' },
    { codigo: '5909200.0', descripcion: 'HA IH Chapa 2,00 x 2,57m' },
    { codigo: '5911000.0', descripcion: 'HA IH Chapa a Dos Aguas 2,57m' },
    { codigo: '5913004.0', descripcion: 'HA IH Cuña c/ Gancho p/ Chapas' },
    { codigo: '5913005.0', descripcion: 'HA IH Cuña p/ Apoyo de Cubierta' },
    { codigo: '5914002.0', descripcion: 'HA IH Base p/ Chapas de Cubierta' },
    { codigo: '5915000.0', descripcion: 'HA IH Apoyo Cubierta p/ 0,73 - 1,90m' },
    { codigo: '5917000.0', descripcion: 'HA IH Barra Inicial Tirante 6,00m' },
    { codigo: '5918400.0', descripcion: 'HA IH Barra Intermedia Tirante 4,00m' },
    { codigo: '5918600.0', descripcion: 'HA IH Barra Intermedia Tirante 6,00m' },
  ]},
  { categoria: 'TECHO TRAMO JORDAN', items: [
    { descripcion: 'Dado Central' },
    { descripcion: 'Dado 40/40' },
    { descripcion: 'Dado 70/70' },
    { descripcion: 'Bulon GDE' },
    { descripcion: 'Dado Puntera' },
    { descripcion: 'Bulon Chico' },
    { descripcion: 'Tramo 40/40' },
    { descripcion: 'Tramo 40/40 Conexion 2m' },
    { descripcion: 'Tramo 40/40 Conexion 3m' },
    { descripcion: 'Tramo 60/60 2m' },
    { descripcion: 'Tramo 60/60 1,55m' },
  ]},
  { categoria: 'TECHO KEDER XL', items: [
    { codigo: '4905000.0', descripcion: 'GI Pasador 2,8mm P/4.905.065' },
    { codigo: '4905666.0', descripcion: 'GI Pasador Abatible D=12mm' },
    { codigo: '5939100.0', descripcion: 'HA KD Diag. Plan. Cubvol.alu 100x257' },
    { codigo: '5940257.0', descripcion: 'HA KD XL Viga Cel Cubvol. 257x050' },
    { codigo: '5972257.0', descripcion: 'Horizontal 2,57 p/Cub. Alu.' },
    { codigo: '5975073.0', descripcion: 'HA XL Soporte 0,73 p/Cubierta Alu.' },
    { codigo: '5975100.0', descripcion: 'HA XL Viga Arranque p/Cub. Alu.' },
    { codigo: '5975110.0', descripcion: 'HA XL 18º Viga Central p/Cub. Alu.' },
    { codigo: '5975300.0', descripcion: 'HA XL Viga p/Cubierta Alumini. 3,00m' },
    { codigo: '5976090.0', descripcion: 'HA KD Bulon 12x95mm' },
  ]},
];

const d = (...descs: string[]): ItemCatalogoRemito[] => descs.map(descripcion => ({ descripcion }));

const PANOL: CategoriaRemito[] = [
  { categoria: 'EQUIPAMIENTO PERSONAL', items: d(
    'Casco de Altura', 'Casco de Piso', 'Pilotos de Lluvia', 'Lentes de Trabajo',
    'Chaleco Refractario', 'Guantes Moteados', 'Botas de Lluvia', 'Arneses',
  )},
  { categoria: 'HERRAMIENTAS', items: d(
    'Llave Nº 11', 'Llave Nº 13', 'Llave Nº 14', 'Llave Nº 15', 'Llave Nº 19', 'Llave Nº 22',
    'Criquet con Tubo', 'Destornillador Plano', 'Destornillador Philips', 'Llave Francesa',
    'Pinza', 'Tenaza', 'Alicate', 'Martillo', 'Pala', 'Pico', 'Maza', 'Maza de Boleo',
  )},
  { categoria: 'MÁQUINAS', items: d(
    'Amoladora Inalámbrica', 'Circular Inalámbrica', 'Sopladora a Nafta', 'Amoladora',
    'Atornilladora', 'Circular', 'Rotopercutor', 'Alto Impacto', 'Inflador a Bateria',
  )},
  { categoria: 'PINTURA', items: d(
    'Aerosol Color', 'Pintura Negra Sintetico', 'Pintura Negra Latex', 'Thiner',
    'Pincel', 'Rodillos', 'Palos de Madera',
  )},
  { categoria: 'ENERGÍA', items: d(
    'Grupo Electrogeno', 'Luz de Trabajo', 'Jabalina c/ Cable', 'Tablero Portatil', 'Zapatillas', 'Alargador',
  )},
  { categoria: 'RACHETS', items: d('Ratchet Largos', 'Ratchet Cortos') },
  { categoria: 'MEDICIÓN', items: d('Nivel de Mano', 'Ruleta 5m', 'Ruleta 10m', 'Ruleta 50m', 'Ruleta 100m') },
  { categoria: 'HIDRATACIÓN', items: d(
    'Termolar', 'Conservadora', 'Vasos de Plastico Descartable', 'Vasos Termicos Descartables',
  )},
  { categoria: 'DESCARTABLES', items: d(
    'Cinta Doble faz', 'Cinta de Papel Blanca', 'Cinta de Papel Negra', 'Cinta Transparente',
    'Cinta Duck Tape', 'Cinta Aisladora', 'Cinta Peligro', 'Film Chico', 'Film Grande',
    'Repuesto de Cutter', 'Repuesto de Grampas', 'Alambre', 'Soguín', 'Disco De Corte',
    'Tornillo Autoperforante', 'Tornillo de Madera', 'Tarugos para Brocas', 'Tizas',
    'Precintos Largos', 'Precintos Cortos', 'Remaches', 'Tanza', 'Puntera HP', 'W40',
  )},
  { categoria: 'LIMPIEZA', items: d(
    'Bolsas de Residuos', 'Rejilla', 'Franela', 'Trapo de Piso', 'Rollo de Cocina', 'Papel Higienico',
    'Detergente', 'Cif', 'Blem', 'Aerosol de Ambiente', 'Pala de Basura', 'Escobillon', 'Balde',
    'Estopa', 'Escurridor / Secador de Piso',
  )},
  { categoria: 'VARIOS', items: d(
    'Engrampadora', 'Cutter', 'Tacho de Basura', 'Perchero', 'Candados', 'Bolsa p/ Colita de Chancho',
    'Bulones p/ Cerramiento Largos / Cortos', 'Enganche Camioneta', 'Iman p/ Metal',
    'Bidon Gasoil', 'Bidon Nafta', 'Tubo 14', 'Tubo 15', 'Tubo 19', 'Tubo 22',
    'Mecha de Widia', 'Mecha del 8', 'Mecha del 10', 'Mecha del 12',
    'Mecha Copa 3/8', 'Mecha Copa 11', 'Mecha Copa',
  )},
];

const LONAS_AFORO: CategoriaRemito[] = [
  { categoria: 'GUÍAS ALUMINIO', items: d('Aluminio 2m', 'Aluminio 4m', 'Aluminio Areas de Trabajo', 'Pieza 036') },
  { categoria: 'LONAS', items: d(
    'Lona Negra 2.57 x 6', 'Lona Negra 2.57 x 8', 'Lona Negra 2.57 x 10', 'Lona Negra 2.57 x 12',
    'Lona Negra 2.57 x 14', 'Lona Negra 0.73 x 12', 'Lona Negra 0.73 x 14', 'Lonas Con Guia',
  )},
  { categoria: 'CARPINES TÉCNICOS', items: d('Carpin Técnico 1.09', 'Carpin Técnico 2.57') },
  { categoria: 'AFORO', items: d('Faldón 50 x 3') },
];

export const CATALOGO_REMITOS: Record<TipoRemitoCatalogo, TipoRemitoInfo> = {
  LAYHER:      { tipo: 'LAYHER',      nombre: 'Layher',         titulo: 'LAYHER',         conCodigo: true,  categorias: LAYHER },
  NACIONAL:    { tipo: 'NACIONAL',    nombre: 'Nacional',       titulo: 'NACIONAL',       conCodigo: false, categorias: NACIONAL },
  TECHOS:      { tipo: 'TECHOS',      nombre: 'Techos',         titulo: 'TECHOS',         conCodigo: true,  categorias: TECHOS },
  PANOL:       { tipo: 'PANOL',       nombre: 'Pañol',          titulo: 'PAÑOL',          conCodigo: false, categorias: PANOL },
  LONAS_AFORO: { tipo: 'LONAS_AFORO', nombre: 'Lonas y Aforo',  titulo: 'LONAS Y AFORO',  conCodigo: false, categorias: LONAS_AFORO },
};
