# Numeração de PV

Crie uma funcionalidade de numeração sequencial de PVs (poços de visita) em polylines 

representando redes de esgoto em planta (dados de arquivo DXF já importados).

NAVEGAÇÃO NA TELA:

- Implementar zoom (scroll do mouse ou botões +/-) e pan (arrastar) no canvas de 

  desenho, para permitir clicar com precisão nas polylines mesmo em desenhos densos.

- O zoom deve manter a precisão de seleção de vértices em qualquer nível de escala.

COMPORTAMENTO DE NUMERAÇÃO:

- O usuário clica em um ponto de referência próximo à extremidade de jusante 

  (downstream) da polyline que representa a quadra/trecho.

- O usuário seleciona a polyline correspondente.

- O sistema identifica o vértice mais próximo do clique como ponto de partida (jusante).

- Os vértices da polyline são ordenados por distância acumulada ao longo do traçado, 

  a partir desse ponto de partida, até a extremidade oposta (montante).

- Cada vértice recebe um rótulo sequencial no formato "PV" + número (ex: PV1, PV2, PV3...).

DETECÇÃO DE NÓ COMPARTILHADO (evitar duplicação):

- Antes de criar um novo PV em qualquer vértice, o sistema deve verificar se já existe 

  um PV cadastrado dentro de um raio de tolerância (parametrizável, padrão 0.05m) 

  daquela posição.

- Se já existir um PV naquele local (por ser extremidade compartilhada entre duas 

  polylines/quadras), o sistema NÃO cria um novo rótulo — reutiliza o PV existente, 

  vincula o segmento atual a ele, e o contador global NÃO avança para esse ponto.

- Deve haver um indicador visual (ex: cor diferente ou ícone) para PVs que já foram 

  numerados, distinguindo de vértices ainda não processados.

- Manter um registro global (mapa/dicionário) de todos os PVs já criados com suas 

  coordenadas, para essa verificação de proximidade funcionar entre diferentes 

  seleções de polylines.

CONTADOR GLOBAL:

- O contador de numeração persiste entre seleções: ao selecionar uma nova quadra, 

  a numeração continua do último número usado + 1 (ignorando os pontos reaproveitados 

  por já existirem).

- O usuário pode definir manualmente o número inicial do contador (offset) e pode 

  resetar o contador.

- O usuário pode desfazer a última numeração aplicada (undo), com rollback do contador 

  global e remoção dos PVs criados nessa ação (sem remover PVs reaproveitados de 

  seleções anteriores).

PRESERVAÇÃO DE DADOS:

- A cota (Z) de cada PV, já calculada por interpolação em face 3D, deve ser preservada 

  e associada ao rótulo, inclusive quando o ponto for reaproveitado de outra seleção.

EXPORTAÇÃO FINAL:

- Ao finalizar o projeto, permitir exportação de todos os PVs numerados em arquivo de 

  texto (.txt ou .csv), com uma linha por PV, no formato:

  PV,E,N,Z

  Exemplo:

  PV1,350125.482,7394521.109,812.35

  PV2,350130.771,7394528.902,811.98

- As coordenadas E (Este) e N (Norte) devem estar no sistema UTM já usado no projeto 

  (mesmo datum/zona do DXF original).

- A elevação Z deve ser a cota interpolada pela face 3D, com 2 a 3 casas decimais.

- O arquivo exportado deve ser ordenado por número de PV crescente.

- Incluir opção de escolher separador (vírgula ou ponto-e-vírgula) e se deseja 

  cabeçalho na primeira linha.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c9f1a9bd-7273-486b-a70d-dc7ab8ce884d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
