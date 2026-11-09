# Reglas del Proyecto y Directivas del Asistente

## REGLA 1: CLASIFICACIÓN DE QUINCENAS POR NOMBRE DE ARCHIVO
Para clasificar cualquier planilla o documento de IVA en la **1ra Quincena (1Q / 1A)** o **2da Quincena (2Q / 2A)**, se debe **LEER EL NOMBRE DEL ARCHIVO QUE SE CARGUE** y clasificar estrictamente a partir de allí como prioridad principal y obligatoria.

### Criterios de Detección en el Nombre de Archivo:
1. **1ra Quincena (`quincena: 1`)**:
   - Patrones de texto: `1A`, `1a`, `1ª`, `1RA`, `1ra`, `1ERA`, `1era`, `PRIMERA`, `primera`, `1Q`, `1q`, `Q1`, `q1`.
   - Rangos de días / fechas: `01 al 15`, `01-15`, `1-15`, `01-02-2026 al 15-02-2026`, etc.
   - Fechas de corte / cierre de quincena: `15-02-2026`, `15/02/2026`, `01-02-2026`, `01/02/2026`.
   - Códigos: `FEB-1`, `FEBRERO-1`, `2026-02-1`, etc.

2. **2da Quincena (`quincena: 2`)**:
   - Patrones de texto: `2A`, `2a`, `2ª`, `2DA`, `2da`, `SEGUNDA`, `segunda`, `2Q`, `2q`, `Q2`, `q2`.
   - Rangos de días / fechas: `16 al 28`, `16 al 29`, `16 al 30`, `16 al 31`, `16-28`, `16-02-2026 al 28-02-2026`, etc.
   - Fechas de corte / cierre de mes: `28-02-2026`, `29-02-2026`, `30-04-2026`, `31-01-2026`, `16-02-2026`.
   - Códigos: `FEB-2`, `FEBRERO-2`, `2026-02-2`, etc.

3. **Independencia de la Fecha de Presentación/Pago**:
   - **NUNCA** clasificar usando la fecha de declaración, presentación o pago (que se realiza entre el 16 y el 25 para la 1ra quincena). La clasificación debe determinarse prioritariamente a partir del **nombre del archivo**.
