// Same chain as the forest map (src/postfx.js in the game): HDR half-float buffer, bloom, colour,
// contrast and vignette, then ACES tone mapping and SMAA at the end. Used by the UHD preview.
import * as THREE from 'three';
import {BloomEffect,BrightnessContrastEffect,EffectComposer,EffectPass,HueSaturationEffect,RenderPass,SMAAEffect,SMAAPreset,ToneMappingEffect,ToneMappingMode,VignetteEffect} from 'postprocessing';

export function createForestPostFX(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,strength=.55,daylight=.34){
 const composer=new EffectComposer(renderer,{frameBufferType:THREE.HalfFloatType,multisampling:0,depthBuffer:true,stencilBuffer:false});
 composer.addPass(new RenderPass(scene,camera));
 const bloom=new BloomEffect({intensity:.34,luminanceThreshold:.72,luminanceSmoothing:.24,mipmapBlur:true,radius:.72,levels:5});
 const color=new HueSaturationEffect({hue:-.006,saturation:.075});
 const contrast=new BrightnessContrastEffect({brightness:-.006,contrast:.055});
 const vignette=new VignetteEffect({offset:.34,darkness:.44});
 composer.addPass(new EffectPass(camera,bloom,color,contrast,vignette));
 composer.addPass(new EffectPass(camera,new ToneMappingEffect({mode:ToneMappingMode.ACES_FILMIC}),new SMAAEffect({preset:SMAAPreset.HIGH})));
 // Same look formula as the forest (strength .55, late-afternoon daylight).
 const configure=(strength:number,daylight:number)=>{const amount=THREE.MathUtils.clamp(strength,0,1),golden=1-Math.min(1,Math.abs(daylight-.5)*2);
 bloom.intensity=.12+amount*(.29+golden*.09);color.saturation=.015+amount*.115;color.hue=-.003-amount*.008;
 contrast.contrast=.012+amount*.078;contrast.brightness=-.002-amount*.012;vignette.offset=.42-amount*.16;vignette.darkness=.16+amount*.55;
 };configure(strength,daylight);
 return {configure,render:(dt:number)=>composer.render(dt),setSize:(w:number,h:number)=>composer.setSize(w,h),dispose:()=>composer.dispose()};
}
