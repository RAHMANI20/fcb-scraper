const puppeteer = require("puppeteer");
const fs = require('fs');
const ObjectsToCsv = require('objects-to-csv');

// cette fonction récupère les liens qui se trouvent dans le fichier liens (profiles facebook)
function getLinksFromFile(file){
  const links = fs.readFileSync(file).toString().split("\n");
  links.pop();
  return links;

}

// cette fonction va cibler les différents élements qu'on veut récuperer pour chaque compte
 async function getData(url,page){

     await page.goto(url);


     if(url.indexOf("/photo/") !== -1){ // ici on traite le cas des liens qui representent des photos de profils; on doit aller à la page de profil
       profilSelector = ".oajrlxb2.g5ia77u1.qu0x051f.esr5mh6w.e9989ue4.r7d6kgcz.rq0escxv.nhd2j8a9.nc684nl6.p7hjln8o.kvgmc6g5.cxmmr5t8.oygrvhab.hcukyx3x.jb3vyjys.rz4wbd8a.qt6c0cv9.a8nywdso.i1ao9s8h.esuyzwwr.f1sip0of.lzcic4wl.gpro0wi8.oo9gr5id.lrazzd5p";
       await page.waitForSelector(profilSelector);
       await page.click(profilSelector);
     }

     await page.waitForTimeout(1000); // on attend 1 seconde pour permettre le chargement des élements html

     // on va récupérer le nom et prénom
     const nameSelector = ".gmql0nx0.l94mrbxd.p1ri9a11.lzcic4wl";
     await page.waitForSelector(nameSelector);
     const scrapedName = await page.$eval(nameSelector,(scrapedElement) => scrapedElement.innerText);

     // pour la résidence et l'entreprise je cible l'intro sur le profil car c'est la partie qui contient forcément ces informations
     const introIsEmpty = await page.$eval(".rq0escxv.l9j0dhe7.du4w35lb.hybvsw6c.io0zqebd.m5lcvass.fbipl8qg.nwvqtn77.k4urcfbm.ni8dbmo4.stjgntxs.sbcfpzgs",(scrapedElement) => (scrapedElement.querySelector("ul") == null));

     // on suppose dans un premier temps que le profil ne contient pas des infos sur l'entreprise et la résidence
     var scrapedCompany = "unknown";
     var scrapedResidence = "unknown";

     if(!introIsEmpty){ // l'intro n'est pas vide, il y a au moi une information : entreprise,etudes,residence,origine.........
         const introFirstElementSelector = ".rq0escxv.l9j0dhe7.du4w35lb.j83agx80.pfnyh3mw.jifvfom9.gs1a9yip.owycx6da.btwxx1t3.jb3vyjys.b5q2rw42.lq239pai.mysgfdmx.hddg9phg";
         // ce que j'ai constaté sur les profil facebook : facebook met tjrs l'information concernat le travail au début de l'intro si elle existe
         // en plus de ça le selecteur du premier element de l'intro differe des autres élement de l'intro
         // remarque : pour savoir le type d'information d'un element je verifie l'icon de l'element

         // on traite le premier element de l'intro
         [scrapedCompany,scrapedResidence] = await page.evaluate((selector) => {

             const scrapedElement = document.querySelector(selector);
             var [company,residence] = ["unknown","unknown"];
             if(scrapedElement != null){
                // on récupere la le lien de l'icon
                const iconLink = scrapedElement.querySelector("img").src;
                // on verifie si l'info concerne l'entreprise
                company = (iconLink == "https://static.xx.fbcdn.net/rsrc.php/v3/yk/r/M0Wls5DHC-A.png") ? scrapedElement.innerText : "unknown";
                // on verifie si l'info concerne la résidence
                residence =  (iconLink == "https://static.xx.fbcdn.net/rsrc.php/v3/yG/r/1sW88456A0B.png") ? scrapedElement.innerText : "unknown";
             }

             return [company,residence];

         },introFirstElementSelector);

        // si la premiere information represente la residence , pas besoin de parcourir le reste
        if(scrapedResidence == "unknown" ){

             // on traite le reste afin de trouver la residence
             const residenceSelector = ".rq0escxv.l9j0dhe7.du4w35lb.j83agx80.pfnyh3mw.jifvfom9.gs1a9yip.owycx6da.btwxx1t3.discj3wi.b5q2rw42.lq239pai.mysgfdmx.hddg9phg";
             scrapedResidence = await page.evaluate((selector) => {
                 const scrapedElements = document.querySelectorAll(selector);
                 if(scrapedElements.length != 0 ){ // on a au moins une information
                     for(let element of scrapedElements){

                       if (element.querySelector("img").src == "https://static.xx.fbcdn.net/rsrc.php/v3/yG/r/1sW88456A0B.png"){
                         return element.querySelector("a").innerText;
                       }
                     }

                 }

                 return "unknown";

             },residenceSelector);

         }

     }

     // mtn on récupere le lien de la photo de profil ; pour les profil fermer on va retourner unknown
     const profilPictureSelector = ".b3onmgus.e5nlhep0.ph5uu5jm.ecm0bbzt.spb7xbtv.bkmhp75w.emlxlaya.s45kfl79.cwj9ozl2";
     scrapedUrlProfilPicture = await page.$eval(profilPictureSelector,(element) => {

       const anchor = element.querySelector("a");
       if(anchor != null){
         return anchor.href;
       }else{
         return "unknown";
       }

     });


     // retourner les données sous format JSON
     return{
       url: url,
       name:scrapedName,
       urlProfilPicture: scrapedUrlProfilPicture,
       residence:scrapedResidence,
       company:scrapedCompany
    }


 }



 //fonction main qui éxécute le tout
 async function main(){

   // création d'une instance de chrome
  const browser = await puppeteer.launch({
      headless:false // ça entraine l'ouverture du navigateur
  });

   // création d'un nouvel onglet
  const page = await browser.newPage()

  // desactiver le timeout
  await page.setDefaultTimeout(0);
  // aller vers la page facebook
  await page.goto("https://www.facebook.com/");

  // on enleve la fenetre des cookies
  const cookieButtonSelector = '[data-cookiebanner="accept_button"]';
  await page.waitForSelector(cookieButtonSelector);
  await page.click(cookieButtonSelector);
  // les selecteur pour les inputs
  const loginInput = '#email';
  const passwordInput = '#pass';
  await page.waitForSelector(loginInput);
  await page.waitForSelector(passwordInput);
  // on remplie les champs avec les informations de connexion
  await page.evaluate((login,password,loginInput,passwordInput) => {
    document.querySelector(loginInput).value = login;
    document.querySelector(passwordInput).value = password;
  },"fifofifo00700@gmail.com","120310ss",loginInput,passwordInput);

  await page.waitForTimeout(2000);

  // on click sur le button se connecter
  const submitButton = 'button[type="submit"]';
  await page.waitForSelector(submitButton);
  await page.click(submitButton);

  await page.waitForTimeout(5000);

  // on récupere les liens des profils
  const links = getLinksFromFile('accounts.txt');
  const scrapedProfil = [] // ici on met les infos récupérée

  // on parcours les profils pour récuperer les informations
  for(let link of links){
     if(link.indexOf("facebook") === -1) continue;
     var profil = await getData(link,page);
     scrapedProfil.push(profil);
  }

  // on ferme le navigateur
  await browser.close();

  // on met les informations dans un fichier csv
  const csv = new ObjectsToCsv(scrapedProfil);
  await csv.toDisk('profiles.csv');

 }


//éxecution du main
main()
