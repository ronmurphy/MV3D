import mv3d from './mv3d.js';
import { Texture, StandardMaterial, Color3 } from './mod_babylon.js';
import { tileWidth, tileHeight } from './util.js';

Object.assign(mv3d,{

	animatedTextures:[],
	textureCache:{},
	materialCache:{},

	getCachedTilesetTexture(setN,animX=0,animY=0){
		const key = `TS:${setN}|${animX},${animY}`;
		if(key in this.textureCache){
			return this.textureCache[key];
		}
		const tsName = $gameMap.tileset().tilesetNames[setN];
		if(!tsName){
			return this.getErrorTexture();
		}
		const textureSrc=`img/tilesets/${tsName}.png`;
		const texture = new Texture(textureSrc,this.scene);
		texture.hasAlpha=true;
		texture.onLoadObservable.addOnce(()=>{
			if(this.textureCache[key]!==texture){ return; }
			texture.updateSamplingMode(1);
			if(animX||animY){
				const { width, height } = texture.getBaseSize();
				texture.frameData={x:0,y:0,w:width,h:height};
				texture.animX = animX;
				texture.animY = animY;
				this.animatedTextures.push(texture);
			}
		});
		this.textureCache[key]=texture;
		return texture;
	},
	getCachedTilesetTextureAsync(setN,animX=0,animY=0){return new Promise((resolve,reject)=>{
		const texture = this.getCachedTileTexture(setN,animX,animY);
		//if(texture.isError){ return void reject(); }
		if(texture.isReady()){
			resolve(texture);
		}else{
			texture.onLoadObservable.addOnce(()=>{ resolve(texture); });
		}
	})},

	/** @deprecated */
	getCachedTileTexture(setN,x,y,w,h){
		const key = `${setN}|${x},${y}|${w},${h}`;
		if(key in this.textureCache){
			return this.textureCache[key];
		}
		const tsName = $gameMap.tileset().tilesetNames[setN];
		if(!tsName){
			return this.getErrorTexture();
		}
		const textureSrc=`img/tilesets/${tsName}.png`;
		const texture = new Texture(textureSrc,this.scene);
		texture.hasAlpha=true;
		texture.onLoadObservable.addOnce(()=>{
			if(this.textureCache[key]!==texture){ return; }
			texture.crop(x,y,w,h);
			texture.updateSamplingMode(1);
			//texture.anisotropicFilteringLevel=4;
			//texture.noMipmap=false;
			if(setN===0){
				const tx = x/tileWidth();
				const ty = y/tileHeight();
				if(tx<6||tx>=8||ty>=6){
					const isWaterfall = tx>=6&&tx<8||tx>=14;
					texture.animX = isWaterfall ? 0 : 2;
					texture.animY = isWaterfall ? 1 : 0;
					texture.frameData={x:x,y:y,w:w,h:h};
					this.animatedTextures.push(texture);
				}
			}
		});
		this.textureCache[key]=texture;
		return texture;
	},

	getErrorTexture(){
		if(this.errorTexture){ return this.errorTexture; }
		this.errorTexture = new Texture(`${mv3d.MV3D_FOLDER}/errorTexture.png`,this.scene);
		this.errorTexture.isError=true;
		return this.errorTexture;
	},

	getBushAlphaTexture(){
		if(this.bushAlphaTexture){ return this.bushAlphaTexture; }
		this.bushAlphaTexture = new Texture(`${mv3d.MV3D_FOLDER}/bushAlpha.png`,this.scene);
		this.bushAlphaTexture.getAlphaFromRGB=true;
		return this.bushAlphaTexture;
	},

	getCachedTilesetMaterial(setN,animX=0,animY=0,options={}){
		this.processMaterialOptions(options);
		const key = `TS:${setN}|${animX},${animY}|${this.getExtraBit(options)}`;
		if(key in this.materialCache){
			return this.materialCache[key];
		}
		const texture = this.getCachedTilesetTexture(setN,animX,animY);
		const material = new StandardMaterial(key, this.scene);
		material.diffuseTexture=texture;
		if(options.transparent){
			material.opacityTexture=texture;
			material.alpha=options.alpha;
		}
		material.alphaCutOff = mv3d.ALPHA_CUTOFF;
		material.ambientColor.set(1,1,1);
		material.emissiveColor.set(options.glow,options.glow,options.glow);
		material.specularColor.set(0,0,0);
		this.materialCache[key]=material;
		return material;
	},

	getCachedTilesetMaterialAsync(setN,animX=0,animY=0,options={}){return new Promise((resolve,reject)=>{
		const material = this.getCachedTilesetMaterial(setN,animX,animY,options);
		const texture = material.diffuseTexture;
		if(texture.isReady()){
			resolve(material);
		}else{
			texture.onLoadObservable.addOnce(()=>{ resolve(material); });
		}
	})},

	async getCachedTilesetMaterialForTile(tileId,x,y,l){
		const setN = mv3d.getSetNumber(tileId);
		const options = mv3d.getMaterialOptions(tileId,x,y,l);
		const animData = mv3d.getTileAnimationData(tileId);
		return await mv3d.getCachedTilesetMaterialAsync(setN,animData.animX,animData.animY,options);
	},

	/** @deprecated */
	getCachedTileMaterial(setN,x,y,w,h,options={}){
		this.processMaterialOptions(options);
		const key = `${setN}|${x},${y}|${w},${h}|${this.getExtraBit(options)}`;
		if(key in this.materialCache){
			return this.materialCache[key];
		}
		const texture = this.getCachedTileTexture(setN,x,y,w,h);
		const material = new StandardMaterial(key, this.scene);
		material.diffuseTexture=texture;
		if(options.transparent){ // alpha blending
			// materials with alpha blending don't cast shadows.
			material.opacityTexture=texture;
			material.alpha=options.alpha;
		}
		material.alphaCutOff = mv3d.ALPHA_CUTOFF;
		material.ambientColor.set(1,1,1);
		material.emissiveColor.set(options.glow,options.glow,options.glow);
		material.specularColor.set(0,0,0);
		this.materialCache[key]=material;
		return material;
	},

	processMaterialOptions(options){
		if('alpha' in options){
			options.alpha = Math.round(options.alpha*7)/7;
			if(options.alph<1){
				options.transparent=true;
			}
		}else{ options.alpha=1; }
		if('glow' in options){
			options.glow = Math.round(options.glow*7)/7;
		}else{ options.glow=0; }
	},

	getExtraBit(options){
		let extra = 0;
		extra|=Boolean(options.transparent)<<0;
		extra|=7-options.alpha*7<<1;
		extra|=options.glow*7<<1;
		return extra.toString(36);
	},

	// animations

	lastAnimUpdate:0,
	animXFrame:0,
	animYFrame:0,
	animDirection:1,
	updateAnimations(){
		if( performance.now()-this.lastAnimUpdate <= this.ANIM_DELAY){ return; }
		this.lastAnimUpdate=performance.now();

		if(this.animXFrame<=0){
			this.animDirection=1;
		}else if(this.animXFrame>=2){
			this.animDirection=-1;
		}
		this.animXFrame += this.animDirection;
		this.animYFrame=(this.animYFrame+1)%3;
		for (const texture of this.animatedTextures){
			texture.crop(
				texture.frameData.x+texture.animX*this.animXFrame*tileWidth(),
				texture.frameData.y+texture.animY*this.animYFrame*tileHeight(),
				texture.frameData.w,
				texture.frameData.h,
			);
		}
	},

});