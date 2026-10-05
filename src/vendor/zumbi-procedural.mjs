/** ABRIGO — zumbi procedural. Sem imports, modelos ou texturas externos.
 * Passe a mesma instância THREE usada pelo jogo. Frente +Z; vertical +Y.
 * Retorno: { mesh, parts, update(dt, state), dispose(), metrics }.
 */
export function criarZumbi(THREE, options = {}) {
  const cfg = {
    height: 1.85, seed: 17, shadows: true,
    ...options
  };
  cfg.colors = { skin: 0xa0aa82, skinDark: 0x737d5c, socket: 0x353b2c,
    eye: 0xe8dfb7, black: 0x24251f, hair: 0x30312b,
    jacket: 0x73533b, lapel: 0x886548, shirt: 0x6d7750,
    pants: 0x354457, shoe: 0x654a34, sole: 0x282922, teeth: 0xdcd3ae,
    ...options.colors };
  if (!(cfg.height > 0) || !Number.isFinite(cfg.height))
    throw new Error('height deve ser um número positivo.');
  const root = new THREE.Group(); root.name = 'ABRIGO_Zumbi';
  const visual = new THREE.Group(); root.add(visual);
  const mats = {}, geometries = new Set();
  for (const [key, color] of Object.entries(cfg.colors)) {
    mats[key] = new THREE.MeshStandardMaterial({
      color, flatShading: true, roughness: 1, metalness: 0
    });
  }
  let randomState = cfg.seed >>> 0;
  function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }
  function mesh(geo, mat, parent, name, p = [0,0,0], s = [1,1,1]) {
    geometries.add(geo);
    const obj = new THREE.Mesh(geo, mats[mat]); obj.name = name;
    obj.position.set(...p); obj.scale.set(...s);
    obj.castShadow = cfg.shadows; obj.receiveShadow = cfg.shadows;
    parent.add(obj); return obj;
  }
  function blob(parent, name, mat, p, s) {
    return mesh(new THREE.IcosahedronGeometry(1, 0), mat, parent, name, p, s);
  }
  function box(parent, name, mat, p, s) {
    return mesh(new THREE.BoxGeometry(1,1,1), mat, parent, name, p, s);
  }
  function joint(parent, name, p) {
    const g = new THREE.Group(); g.name = name; g.position.set(...p);
    parent.add(g); return g;
  }
  // Perfil extrudado: o contorno cria os rasgos reais, sem decalques.
  function panel(parent, name, mat, points, z, depth = 0.025) {
    const shape = new THREE.Shape(); shape.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) shape.lineTo(...points[i]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: false, steps: 1, curveSegments: 1
    });
    return mesh(geo, mat, parent, name, [0,0,z]);
  }
  // Volume em anéis de oito vértices. Evita membros esféricos.
  function rings(parent, name, mat, sections) {
    const positions = [], indices = [];
    const perimeter = [[-.65,-1],[.65,-1],[1,-.65],[1,.65],
      [.65,1],[-.65,1],[-1,.65],[-1,-.65]];
    sections.forEach(([y, rx, rz, cx=0, cz=0]) => {
      perimeter.forEach(([x,z]) => positions.push(cx+x*rx,y,cz+z*rz));
    });
    for(let row=0;row<sections.length-1;row++) for(let j=0;j<8;j++) {
      const a=row*8+j,b=row*8+(j+1)%8,c=a+8,d=b+8;
      if(sections[row+1][0]>sections[row][0]) indices.push(a,c,b,b,c,d);
      else indices.push(a,b,c,b,d,c);
    }
    const ascending=sections[1][0]>sections[0][0];
    for(let j=1;j<7;j++) {
      if(ascending)indices.push(0,j,j+1); else indices.push(0,j+1,j);
    }
    const last=(sections.length-1)*8;
    for(let j=1;j<7;j++) {
      if(ascending)indices.push(last,last+j+1,last+j);
      else indices.push(last,last+j,last+j+1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setIndex(indices); geo.computeVertexNormals();
    return mesh(geo,mat,parent,name);
  }
  function segment(parent,name,mat,a,b,r1,r2,sides=5) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
    const direction=end.clone().sub(start);
    const obj=mesh(new THREE.CylinderGeometry(r2,r1,direction.length(),sides),
      mat,parent,name);
    obj.position.copy(start).add(end).multiplyScalar(.5);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
    return obj;
  }
  // Unidades de construção: cabeça até aproximadamente Y=2.
  const pelvis = joint(visual,'pelvis',[0,1.01,0]);
  blob(pelvis,'quadril','pants',[0,0,0],[.255,.18,.16]);
  box(pelvis,'cos','pants',[0,.035,.01],[.46,.07,.32]);
  const torso = joint(pelvis,'tronco',[0,.10,0]);
  rings(torso,'camisa','shirt',[
    [-.03,.21,.14],[.20,.23,.145],[.44,.28,.15],[.51,.23,.12]
  ]);
  rings(torso,'costas_jaqueta','jacket',[
    [-.03,.24,.15,0,-.025],[.25,.27,.15,0,-.025],
    [.48,.30,.14,0,-.025],[.53,.23,.10,0,-.025]
  ]);
  // Painel central da camisa recobre o volume da jaqueta aberta.
  panel(torso,'camisa_frente','shirt',[
    [-.11,-.02],[.12,-.02],[.16,.41],[.08,.47],[-.09,.47],[-.15,.40]
  ],.151);
  panel(torso,'gola_camisa_E','shirt',[
    [-.12,.44],[-.01,.39],[-.075,.31],[-.16,.39]
  ],.18);
  panel(torso,'gola_camisa_D','shirt',[
    [.02,.39],[.12,.44],[.16,.37],[.085,.32]
  ],.18);
  for(const side of [-1,1]) {
    const prefix=side===-1?'E':'D';
    const mirrored=points=>points.map(([x,y])=>[x*side,y]);
    panel(torso,`frente_jaqueta_${prefix}`,'jacket',mirrored([
      [.09,.45],[.22,.51],[.30,.43],[.25,.13],[.26,-.08],
      [.19,-.04],[.20,-.15],[.13,-.08],[.09,-.12],[.10,.19]
    ]),.174,.035);
    panel(torso,`lapela_${prefix}`,'lapel',mirrored([
      [.09,.46],[.22,.51],[.22,.39],[.16,.33],[.21,.30],[.095,.21]
    ]),.216,.018);
  }
  box(torso,'botoes_camisa','skinDark',[.025,.18,.192],[.017,.017,.01]);
  const neck=joint(torso,'pescoco',[0,.49,0]);
  rings(neck,'pele_pescoco','skin',[[0,.095,.08],[.26,.085,.08]]);
  const head=joint(neck,'cabeca',[0,.26,0]);
  // Mandíbula estreita, têmporas largas e testa angular.
  rings(head,'cranio','skin',[
    [-.145,.085,.085,0,.015],[-.085,.13,.105],
    [.035,.15,.115],[.17,.142,.105],[.235,.105,.075]
  ]);
  for(const side of [-1,1]) {
    blob(head,`orelha_${side}`,'skin',[side*.15,.055,-.005],[.045,.065,.025]);
    const socket=blob(head,`orbita_${side}`,'socket',
      [side*.071,.064,.11],[.061,.053,.028]);
    socket.rotation.z=side*.15;
    blob(head,`olho_${side}`,'eye',
      [side*.071,.063,.133],[.031,.026,.014]);
    box(head,`pupila_${side}`,'black',
      [side*.071,.063,.148],[.013,.018,.006]);
    const brow=box(head,`sobrancelha_${side}`,'skinDark',
      [side*.072,.113,.13],[.10,.026,.04]);
    brow.rotation.z=-side*.22;
    blob(head,`pomulo_${side}`,'skinDark',
      [side*.108,-.003,.10],[.036,.038,.029]);
  }
  blob(head,'nariz','skin',[0,.008,.139],[.033,.065,.058]);
  for(const side of [-1,1]) box(head,`narina_${side}`,'skinDark',
    [side*.020,-.023,.166],[.015,.010,.012]);
  const jaw=joint(head,'mandibula',[0,-.035,.083]);
  panel(jaw,'boca_escura','black',[
    [-.076,-.025],[-.052,.008],[.046,.004],[.077,-.025],
    [.060,-.064],[-.042,-.058]
  ],.039,.008);
  for(const [i,x] of [-.043,-.013,.040].entries())
    box(jaw,`dente_superior_${i}`,'teeth',[x,-.013,.055],[.023,.025,.012]);
  box(jaw,'dente_inferior','teeth',[.024,-.046,.055],[.023,.016,.012]);
  blob(jaw,'queixo','skin',[0,-.078,.005],[.076,.042,.053]);
  // Cabelo: touca facetada + mechas triangulares sólidas.
  rings(head,'cabelo_base','hair',[
    [.165,.148,.113,0,-.008],[.245,.135,.095,0,-.009],
    [.285,.075,.065,0,-.018]
  ]);
  for(let i=0;i<9;i++) {
    const x=-.145+i*.035;
    const length=.045+random()*.045;
    panel(head,`franja_${i}`,'hair',[
      [x-.03,.235],[x+.035,.23],[x+.013,.16-length]
    ],.113+random()*.01,.022);
  }
  for(let i=0;i<7;i++) {
    const theta=i*Math.PI*2/7;
    const base=[Math.cos(theta)*.10,.255,Math.sin(theta)*.065];
    const tip=[base[0]*1.6,.29+random()*.05,base[2]*1.6];
    segment(head,`mecha_topo_${i}`,'hair',base,tip,.043,0,3);
  }
  const arms=[],legs=[];
  for(const side of [-1,1]) {
    const prefix=side===-1?'E':'D';
    const shoulder=joint(torso,`ombro_${prefix}`,[side*.275,.43,0]);
    blob(shoulder,`manga_ombro_${prefix}`,'jacket',[side*.018,-.07,0],
      [.12,.16,.125]);
    rings(shoulder,`braco_${prefix}`,'jacket',[
      [0,.095,.09],[-.17,.085,.075],[-.29,.065,.063]
    ]);
    const elbow=joint(shoulder,`cotovelo_${prefix}`,[0,-.29,0]);
    rings(elbow,`antebraco_${prefix}`,'skin',[
      [0,.065,.060],[-.15,.059,.052],[-.28,.039,.038]
    ]);
    // Manga termina em pontas e deixa o antebraço exposto.
    panel(elbow,`rasgo_manga_${prefix}`,'jacket',[
      [-.07,.06],[.07,.06],[.072,-.08],[.025,-.045],
      [.010,-.11],[-.018,-.06],[-.065,-.095]
    ],.061,.018);
    const wrist=joint(elbow,`punho_${prefix}`,[0,-.29,0]);
    blob(wrist,`palma_${prefix}`,'skin',[0,-.068,.006],[.063,.091,.035]);
    for(let finger=0;finger<4;finger++) {
      const x=(finger-1.5)*.025;
      const length=[.075,.09,.083,.065][finger];
      segment(wrist,`dedo_${prefix}_${finger}`,'skin',
        [x,-.112,.010],[x,-.112-length,.025],.012,.010,4);
      segment(wrist,`dedo_curvado_${prefix}_${finger}`,'skin',
        [x,-.112-length,.025],[x,-.12-length,.058],.010,.008,4);
    }
    segment(wrist,`polegar_${prefix}`,'skin',
      [-side*.045,-.055,.005],[-side*.085,-.11,.035],.022,.016,4);
    arms.push({shoulder,elbow,wrist,side});

    const hip=joint(pelvis,`quadril_${prefix}`,[side*.135,-.035,0]);
    rings(hip,`coxa_${prefix}`,'pants',[
      [0,.115,.13],[-.20,.108,.105],[-.405,.079,.081]
    ]);
    const knee=joint(hip,`joelho_${prefix}`,[0,-.405,0]);
    rings(knee,`canela_${prefix}`,'pants',[
      [0,.079,.081],[-.20,.063,.063],[-.385,.051,.051]
    ]);
    // Rasgo geométrico no joelho esquerdo; a abertura expõe a pele.
    if(side===-1) {
      panel(knee,'joelho_exposto','skin',[
        [-.057,.045],[-.025,.074],[.02,.031],[.057,.060],
        [.052,-.051],[.012,-.073],[-.039,-.048]
      ],.083,.016);
      panel(knee,'aba_rasgada_joelho','pants',[
        [-.079,.075],[.078,.075],[.050,.010],[.02,.04],
        [-.015,-.006],[-.045,.035],[-.068,.006]
      ],.105,.014);
    }
    const ankle=joint(knee,`tornozelo_${prefix}`,[0,-.385,0]);
    rings(ankle,`pele_tornozelo_${prefix}`,'skin',[
      [.07,.048,.048],[-.015,.043,.043]
    ]);
    panel(ankle,`barra_rasgada_${prefix}`,'pants',[
      [-.057,.13],[.057,.13],[.056,.023],[.025,.050],
      [.006,.008],[-.012,.062],[-.042,.016]
    ],.052,.014);
    box(ankle,`sola_${prefix}`,'sole',[0,-.035,.058],[.15,.045,.285]);
    rings(ankle,`sapato_${prefix}`,'shoe',[
      [-.013,.075,.14,0,.058],[.065,.072,.13,0,.052],
      [.11,.050,.055,0,-.01]
    ]);
    legs.push({hip,knee,ankle,side});
  }
  // Pose de referência: cabeça inclinada, um ombro mais baixo, mãos caídas.
  torso.rotation.set(.065,0,.055); head.rotation.set(.035,.06,-.14);
  jaw.rotation.x=.04;
  for(const a of arms) {
    a.shoulder.rotation.set(-.15,0,a.side*.16);
    a.elbow.rotation.x=-.14; a.wrist.rotation.x=.10;
  }
  for(const l of legs) {
    l.hip.rotation.z=l.side*.045;
    l.knee.rotation.x=l.side===-1?.10:.045;
    l.ankle.rotation.x=-l.knee.rotation.x;
  }
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root);
  visual.position.y=-bounds.min.y;
  const scale=cfg.height/(bounds.max.y-bounds.min.y);
  root.scale.setScalar(scale);
  const animated=[torso,head,...arms.flatMap(a=>[a.shoulder,a.elbow,a.wrist]),
    ...legs.flatMap(l=>[l.hip,l.knee,l.ankle])];
  const neutral=new Map(animated.map(g=>[g,g.rotation.clone()]));
  let time=0,disposed=false;
  function update(dt,state='idle') {
    if(disposed)return;
    if(!Number.isFinite(dt)||dt<0)throw new Error('dt deve ser segundos >= 0.');
    time+=Math.min(dt,.10);
    animated.forEach(g=>g.rotation.copy(neutral.get(g)));
    const walk=state==='walk';
    torso.rotation.z+=Math.sin(time*1.4)*.012;
    head.rotation.z+=Math.sin(time*.8)*.016;
    if(walk) {
      // Ciclo visual; a locomoção e o contato com o chão pertencem ao ABRIGO.
      const phase=time*3.6;
      for(const l of legs) {
        const step=Math.sin(phase+(l.side===1?Math.PI:0));
        l.hip.rotation.x=step*.22;
        l.knee.rotation.x+=Math.max(0,-step)*.24;
        l.ankle.rotation.x=-l.knee.rotation.x*.6;
      }
      for(const a of arms) {
        a.shoulder.rotation.x+=Math.sin(phase+(a.side===1?0:Math.PI))*.10;
        a.elbow.rotation.x+=Math.sin(phase+.7)*.025;
      }
    }
  }
  let triangles=0,meshCount=0;
  root.traverse(o=>{if(o.isMesh){meshCount++;
    triangles+=(o.geometry.index?o.geometry.index.count:
      o.geometry.attributes.position.count)/3;
  }});
  const metrics={triangles,meshes:meshCount,materials:Object.keys(mats).length,
    height:cfg.height};
  const parts={pelvis,torso,neck,head,jaw,arms,legs};
  function dispose() {
    if(disposed)return; disposed=true;
    if(root.parent)root.parent.remove(root);
    geometries.forEach(g=>g.dispose()); Object.values(mats).forEach(m=>m.dispose());
  }
  root.userData.characterType='zombie';
  root.userData.procedural=true;
  return {mesh:root,parts,update,dispose,metrics};
}

