npm install yapmadan önce terminalde şu komutu çalıştırıp nodejs için parametre belirlemeniz gerekiyor,

 

export NODE_OPTIONS=--openssl-legacy-provider

 

Ek olarak package.json’ı ilk defa kopyaladığınız direk npm install değil şu komutu çalıştırmalısınız,

 

npm install react@17 react-dom@17

 

sonrasında npm install diyerek diğer paketleri kurabilirsiniz.

Ampilfy init ile gerekli bilgileri uygulamaya entegre etmeniz gerekiyor

https://catalog.us-east-1.prod.workshops.aws/workshops/2b414187-7e55-4729-a998-c698d9429876/en-US/30-adding-auth/10-adding-auth-back