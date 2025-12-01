import dayjs from 'dayjs';   
import { db } from "../../../config/db.js";   
import soap from "strong-soap";  
const soapWsa = soap.soap; 

export const Projection_GetShipper = async() => {   
    const currentDate = dayjs();   
    const domain = 100;

    const previousDay = currentDate.subtract(1, 'day');  
    const day = previousDay.date(); 
    const year = previousDay.year();      
    const month = previousDay.month() + 1;
  
    const getWSA = async (url, name, args) => {    
        return new Promise((resolve, reject) => {    
            const options = {};  
          
            soapWsa.createClient(url, options, (err, client) => {    
                if (err) {    
                    return reject(`Error creating SOAP client: ${err}`);    
                }    
              
                const method = client[name];    
                if (!method) {    
                    return reject(`Method ${name} not found on the client.`);    
                }    
              
                method(args, (err, result, envelope, soapHeader) => {    
                    if (err) {    
                        return reject(`Error calling method ${name}: ${err}`);    
                    }    
                    resolve(result);    
                });    
            });    
        });    
    };    
        
    const fetchWSA = async (date) => {  
        console.log('Fetching Data...')  
        const url = 'https://qssiptdldb07.odqad.com:8143/wsa/wsadbc/wsdl?targetURI=urn:services-qad-com:wsadbc:0001';    
        const methodName = 'getShipper';  
        const params = {    
            parDomain: '100',    
            ShipDateFr: date,    
            ShipDateTo: date,   
        };    
          
        try {    
            const result = await getWSA(url, methodName, params);    
            
            console.log(result.listSuratJalan.listSuratJalanRow)
            return result.listSuratJalan.listSuratJalanRow;  
        } catch (error) {    
            console.error('Error fetching SOAP API:', error);    
        }    
    };          
       
    const fetchGroupProduct = await db('dbPortalFA.dbo.map_aktual_vol')  
        .select('group_product')  
        .whereNot('kategori', 'CA')  
        .where('domain', domain);  
      
    const wsaData = await fetchWSA(`${year}-${month}-${day}`);  
  
    const groupProducts = fetchGroupProduct.map(g => g.group_product.toUpperCase());  
    const filteredWSA = wsaData.filter(item => groupProducts.includes(item.group_item.toUpperCase()))  
        .map(item => ({    
            ship_date: item.ship_date,    
            group_item: item.group_item,    
            item_nbr: item.item_nbr,    
            item_name: item.item_name,    
            qty: item.qty,    
            tonase: item.tonase,    
            channel: item.channel,    
            order_date: item.order_date    
        }));  
   
    await Promise.all(filteredWSA.map(async (item) => {  
        await db('transaksi_volume_aktual').insert({  
            domain: domain,
            ship_date: item.ship_date,  
            order_date: item.order_date,  
            item_nbr: item.item_nbr,  
            item_name: item.item_name,  
            qty: item.qty,  
            tonase: item.tonase,  
            channel: item.channel,  
            group_item: item.group_item,  
            created_by: 1,        
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),        
            updated_by: 1,        
            updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"), 
        });  
    }));  
  
    return filteredWSA;
}  
