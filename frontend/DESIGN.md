---
name: COMMUNITY 360
description: Manual de acetato para leer el flujo ETL con claridad y cuidado.
colors:
  paper: "#f1eee4"
  paper-rail: "#e8e4d8"
  sheet: "#faf8f0"
  sheet-warm: "#f6f1e4"
  ink: "#211f1a"
  ink-soft: "#444139"
  ink-muted: "#615d53"
  line: "#9c978a"
  line-soft: "#d3cec0"
  yellow: "#e7bd3d"
  orange: "#a44727"
  green: "#52633b"
  teal: "#246d66"
  blue: "#3e5b89"
  violet: "#665374"
  sienna: "#765334"
typography:
  display:
    fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif'
    fontSize: "clamp(2.8rem, 5.2vw, 5rem)"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.025em"
  headline:
    fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif'
    fontSize: "clamp(1.7rem, 2.6vw, 2.3rem)"
    fontWeight: 700
    lineHeight: 1.05
  body:
    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif'
    fontSize: "clamp(0.9rem, 1vw, 1rem)"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.13em"
spacing:
  xs: "8px"
  sm: "13px"
  md: "18px"
  lg: "30px"
components:
  refresh-button:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    padding: "8px 13px"
    height: "44px"
  connection-chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-soft}"
    padding: "0 9px"
    height: "30px"
  metric-strip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    padding: "17px clamp(14px, 2vw, 25px) 19px"
  section-navigation:
    backgroundColor: "{colors.paper-rail}"
    textColor: "{colors.ink-soft}"
    padding: "6px 9px"
  empty-state:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-soft}"
  distribution-bar:
    backgroundColor: "{colors.sheet-warm}"
    textColor: "{colors.ink-soft}"
---

# Design System: COMMUNITY 360

## Overview

**Creative North Star: "El manual de acetato"**

COMMUNITY 360 se lee como una hoja de referencia de clase: papel cálido, tinta firme y pestañas cromáticas que separan capas del proceso sin convertir cada cifra en una tarjeta decorativa. La composición favorece una lectura serena, directa y técnica, con titulares condensados y texto de sistema cómodo para consultar.

La interfaz conserva superficies planas, divisores precisos y jerarquía editorial. En pantallas amplias, el índice permanece al lado del contenido; en móvil, se vuelve una banda horizontal y el contenido se apila. El color ayuda a orientarse, pero nunca sustituye una etiqueta escrita.

**Key Characteristics:**
- Papel marfil y tinta oscura con contraste alto.
- Pestañas de color pequeñas, etiquetadas y semánticas.
- Titulares condensados frente a texto de lectura sobrio.
- Paneles planos, divisores finos y un único relieve suave al interactuar.

## Colors

La paleta se inspira en acetato de oficina y tinta impresa: cálida y baja en ruido, con acentos que distinguen funciones.

### Primary
- **Acetato marfil** (`paper`, `sheet`, `sheet-warm`): superficies de fondo y lectura.
- **Tinta de impresión** (`ink`, `ink-soft`, `ink-muted`): jerarquía de texto y estados secundarios.

### Secondary
- **Amarillo cromo** (`yellow`): acción principal y foco cromático.
- **Óxido** (`orange`): cuarentena y advertencias.
- **Verde hoja** (`green`): estado satisfactorio.
- **Verde azulado** (`teal`): interacciones válidas y actividad.

### Tertiary
- **Ultramar** (`blue`): canales y datos de proceso.
- **Violeta apagado** (`violet`): privacidad y clasificación.
- **Siena** (`sienna`): acento secundario disponible para pestañas.

### Neutral
- **Papel de índice** (`paper-rail`): separa la navegación lateral del área de lectura.
- **Regla impresa** (`line`, `line-soft`): divisores y bordes; los lavados cromáticos quedan reservados para superficies de estado.

### Named Rules
**The Labeled Tab Rule.** El color siempre acompaña texto; nunca comunica estado por sí solo.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, sans-serif fallback)  
**Body Font:** Inter (with Segoe UI, Arial, sans-serif fallback)

**Character:** El display condensado recuerda los rótulos de una hoja de proceso. El cuerpo mantiene una voz neutra y espaciosa para que el contraste entre el tono visual y la lectura siga siendo cómodo.

Barlow Condensed se sirve localmente desde `public/fonts/` en pesos 400 y 700, con sus archivos fuente en `../assets/fonts/`. El texto general usa una pila de sistema y no solicita fuentes externas.

### Hierarchy
- **Display:** título principal con ajuste de línea equilibrado.
- **Headline:** encabezados de sección, claramente por debajo del título principal.
- **Title:** encabezados de panel y estados vacíos.
- **Body:** explicación y lectura, con medidas de hasta 66ch.
- **Label:** navegación, métricas y estado; las etiquetas de índice usan espaciado amplio entre letras.

### Named Rules
**The Condensed Display Rule.** Barlow Condensed organiza títulos y cifras; el texto de lectura permanece en la familia de sistema.

## Layout

El escritorio usa una columna lateral de 248px y un área principal limitada a 1440px. A 1000px, el índice se estrecha a 208px; a 760px pasa a una fila desplazable en la parte superior. Por debajo de 560px, indicadores y paneles se apilan para conservar el orden de lectura. El ritmo vertical de las secciones es generoso, con separaciones menores para agrupar etiquetas y valores.

## Elevation & Depth

La profundidad se construye con superficies de papel levemente distintas y reglas de un píxel. No hay sombras permanentes en los paneles; el botón de actualización recibe un relieve suave solo al pasar el puntero.

### Shadow Vocabulary
- **Relieve de acción** (`0 7px 18px rgb(34 31 25 / 7%)`): hover del botón de actualización.

### Named Rules
**The Flat Sheet Rule.** Los paneles permanecen planos; el relieve se reserva para una acción interactiva.

## Shapes

La forma es cuadrada y editorial: rectángulos con bordes finos, pestañas pequeñas y separadores rectos. Los indicadores de conexión son puntos circulares; no se usan esquinas redondeadas como lenguaje dominante.

## Components

### Buttons
- **Refresh:** superficie amarilla, borde oscuro y altura cómoda para interacción.
- **Hover / Focus:** el hover añade un levantamiento mínimo y sombra suave; el foco de teclado conserva un contorno visible de alto contraste.
- **Disabled:** pierde saturación y bloquea la acción mientras no exista una API configurada o haya una consulta en curso.

### Chips
- **Connection status:** etiqueta textual sobre papel claro, acompañada por un punto; conectado/desconectado nunca se indica solo con color.

### Cards / Containers
- **Interaction strip:** una única superficie dividida en tres columnas por reglas finas; cada capa usa una pestaña de color pequeña, no una colección de tarjetas flotantes.
- **Activity sheet:** área de gráfica y estado vacío sobre una hoja clara; la distribución usa un panel cálido separado por una regla.
- **Quality ledger:** filas horizontales con cifras alineadas y divisores, no una tarjeta anidada.

### Navigation
- **Section index:** pestañas rotuladas en una columna lateral en escritorio; se convierte en una fila con desplazamiento horizontal en móvil. El hover agrega una superficie clara y el foco conserva un contorno visible.

### Signature Component
- **Empty state:** un icono discreto, un título y una explicación breve ocupan el lugar del contenido no disponible; nunca se rellena con una gráfica de muestra.

## Do's and Don'ts

### Do:
- **Do** mantener el fondo marfil y reservar los acentos para identificar capas o estados.
- **Do** acompañar cada pestaña cromática con su nombre o explicación.
- **Do** conservar el contraste de tinta sobre papel y un foco de teclado claramente visible.
- **Do** usar estados vacíos explícitos cuando la fuente de datos no esté conectada.

### Don't:
- **Don't** añadir un kicker o eyebrow encima de un encabezado.
- **Don't** convertir la composición en una pared genérica de tarjetas métricas.
- **Don't** sustituir los estados vacíos por datos o gráficas ficticias.
- **Don't** mostrar mapas geográficos ni ubicaciones individuales. La vista solo puede mostrar ciudades agregadas de usuarios con consentimiento, con un mínimo de cinco por grupo y sin coordenadas.
