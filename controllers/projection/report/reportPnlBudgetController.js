import { db } from "../../../config/db.js";    
import { getMonthName, roundToTwoDecimalPlaces } from "../../../helpers/utils.js";    
import * as dotenv from 'dotenv';    
    
dotenv.config();    
    
const checkResponseCompletion = (response, res) => { 
    sendData(res, response);
}; 

const sendData = (res, data) => {  
    res.write(`data: ${JSON.stringify(data)}\n\n`);  
};

const isEmpty = (obj) => {  
    for (let key in obj) {  
        if (obj.hasOwnProperty(key)) {  
            return false;
        }  
    }  

    return true;
}; 

// Main function to get the projection report    
export const Projection_ReportPnlBudget = async (req, res) => {    
    try {    
        const { domain, tahun } = req.query;    
        const response = [];
        let processPenjualanBersih = false;   

        res.setHeader('Content-Type', 'text/event-stream');  
        res.setHeader('Cache-Control', 'no-cache');  
        res.setHeader('Connection', 'keep-alive'); 
    
        let completedWorkers = 0;  
        const totalWorkers = 81;

        const checkIfAllWorkersCompleted = () => {  
            completedWorkers++;
        
            if (completedWorkers === totalWorkers) {  
                sendData(res, 'complete');  
            }  
        };

        // Fetch jenis produksi for different categories    
        const fetchJenisProduksi = async (types) => {    
            return await db('dbPortalFA.dbo.jenis_produksi')    
                .select('jenis_produksi_id', 'jenis_produksi')    
                .where('domain', domain)    
                .whereIn(db.raw('LOWER(jenis_produksi)'), types);    
        };    
    
        const jenisProduksi = await fetchJenisProduksi(["pvc retail", "pvc jis", "fitting im", "ruglue"]);    
        const jenisProduksiProject = await fetchJenisProduksi(["pvc sni", "pipa exoplast", "pipa pe", "pipa tigris", "fitting tigris"]);    
        const jenisProduksiNonProduksi = await fetchJenisProduksi(["spool pipe", "jacking pipe", "syfon system", "access fitting"]);    
        
        const jenisProduksiPipa = await fetchJenisProduksi(["pvc retail", "pvc jis", "pvc sni", "pipa exoplast", "pipa pe", "pipa tigris"])
        const jenisProduksiPipaNonProduksi = await fetchJenisProduksi(["spool pipe", "jacking pipe"])
        
        const jenisProduksiFitting = await fetchJenisProduksi(["fitting im", "fitting tigris"]);
        const jenisProduksiGlue = await fetchJenisProduksi(["ruglue"]);
        const jenisProduksiOther = await fetchJenisProduksi(["syfon system", "access fitting"]);
        const jenisProduksiCogsTrading = await fetchJenisProduksi(["syfon system", "access fittings"])

        // Hitung Sales Volume
        const getVolumeSales = await fetchVolumeSales(tahun, domain)
        let fiscalVolumeSales = 0;
        const volumeSalesTotal = {  
            index: 1,  
            description: 'Sales Volume',  
            type: 'mainRow',  
            ...getVolumeSales.reduce((acc, vs) => { 
                const monthKey = `${vs.nama_bulan.toLowerCase().slice(0, 3)}Value`;    
                const percentKey = `${vs.nama_bulan.toLowerCase().slice(0, 3)}Percent`;    
                acc[monthKey] = roundToTwoDecimalPlaces(vs.total_volume_budget);    
                acc[percentKey] = 'Ton';

                fiscalVolumeSales += vs.total_volume_budget;
                return acc;  
            }, {})  
        };
        
        let lastFiscalValue = 0;
        const getVolumeSalesLast = await fetchVolumeSales(tahun -1, domain)
        getVolumeSalesLast.forEach((vs) => { 
            lastFiscalValue += vs.total_volume_budget;
        }) 

        volumeSalesTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalVolumeSales);
        volumeSalesTotal['actualFiscalPercent'] = 'Ton'

        const lastFiscalYearSalesVolumes = await fetchVolumeSalesLastYear(tahun - 1, domain);
        volumeSalesTotal['lastFiscalValue'] =  roundToTwoDecimalPlaces(lastFiscalYearSalesVolumes);
        volumeSalesTotal['lastFiscalPercent'] = 'Ton'

        if(!volumeSalesTotal.janValue) sendData(res, 'blank');

        response.push(volumeSalesTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();
        // Selesai Hitung Sales Volume
    
        // Hitung Penjualan Bruto
        const getPenjualanBruto = await fetchPenjualanBruto(jenisProduksi, jenisProduksiProject, jenisProduksiNonProduksi, tahun, domain)
        let fiscalPenjualanBruto = 0;
        const monthlyTotals = {  
            index: 2,  
            description: 'PENJUALAN BRUTO',  
            type: 'mainRow',  
            ...getPenjualanBruto.reduce((acc, vs) => { 
                const monthKey = `${String(getMonthName(vs.month)).toLowerCase().slice(0, 3)}Value`;    
                acc[monthKey] = roundToTwoDecimalPlaces(vs.total);

                fiscalPenjualanBruto += vs.total;
                return acc;  
            }, {})  
        };

        monthlyTotals['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalPenjualanBruto);

        const lastFiscalPenjualanBruto = await calculateLastYearFiscal('penjualan bruto', tahun -1, domain);
        monthlyTotals['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalPenjualanBruto);

        response.push(monthlyTotals);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();
        // Selesai Hitung Penjualan Bruto

        // Hitung Potongan Penjualan
        const getPotonganPenjualan = await fetchPotonganPenjualan(jenisProduksi, jenisProduksiProject, jenisProduksiNonProduksi, tahun, domain)
        let fiscalPotonganPenjualan = 0;
        const potonganPenjualanTotals = {  
            index: 3,  
            description: 'POTONGAN PENJUALAN',  
            type: 'subRow',  
            ...getPotonganPenjualan.reduce((acc, vs) => { 
                const monthKey = `${String(getMonthName(vs.month)).toLowerCase().slice(0, 3)}Value`;    
                acc[monthKey] = roundToTwoDecimalPlaces(vs.total);

                fiscalPotonganPenjualan += vs.total;
                return acc;  
            }, {})  
        };

        potonganPenjualanTotals['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalPotonganPenjualan);
        potonganPenjualanTotals['actualFiscalPercent'] = roundToTwoDecimalPlaces((parseFloat(fiscalPotonganPenjualan) / parseFloat(fiscalPenjualanBruto)) || 0)
        
        const lastFiscalPotonganPenjualan = await calculateLastYearFiscal('potongan penjualan', tahun - 1, domain);
        potonganPenjualanTotals['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalPotonganPenjualan);
        potonganPenjualanTotals['lastFiscalPercent'] = roundToTwoDecimalPlaces((parseFloat(lastFiscalPotonganPenjualan) / parseFloat(lastFiscalPenjualanBruto)) || 0)
        
        monthlyTotals['actualFiscalPercent'] = roundToTwoDecimalPlaces(100 - (parseFloat(fiscalPotonganPenjualan) / parseFloat(fiscalPenjualanBruto)) || 0)
        monthlyTotals['lastFiscalPercent'] = roundToTwoDecimalPlaces(100 - (parseFloat(lastFiscalPotonganPenjualan) / parseFloat(lastFiscalPenjualanBruto)) || 0)

        response.push(potonganPenjualanTotals);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();
        // Selesai Potongan Penjualan

        const getPipa = await fetchPipaData(jenisProduksiPipa, jenisProduksiPipaNonProduksi, tahun, domain)
        let fiscalPipa = 0;
        let fiscalPercentPipa = 0;
        const pipaTotals = {  
            index: 5,  
            description: 'Pipa',  
            type: 'subRow',  
            ...getPipa.reduce((acc, vs) => { 
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;    
                    const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);
                    acc[monthPercent] = roundToTwoDecimalPlaces(vs.percent);

                    fiscalPipa += vs.total;
                    fiscalPercentPipa += vs.percent;
                }  

                return acc;  
            }, {})  
        }; 

        pipaTotals['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalPipa);
        pipaTotals['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalPercentPipa / 12);

        let lastFiscalPipa = await calculateLastYearFiscal('pipa', tahun - 1, domain);
        pipaTotals['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalPipa || 0);

        const denominator = lastFiscalPenjualanBruto + lastFiscalPotonganPenjualan
        let lastFiscalPercentPipa = (denominator === 0) ? 0 : lastFiscalPipa / denominator;
        pipaTotals['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentPipa)

        response.push(pipaTotals);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getFitting = await fetchComponentData(jenisProduksiFitting, tahun, domain)
        let fiscalYearFitting = 0;
        let fiscalPercentFitting = 0;
        const fittingTotal = {  
            index: 6,  
            description: 'Fittings',  
            type: 'subRow',  
            ...getFitting.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;    
                    const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);
                    acc[monthPercent] = roundToTwoDecimalPlaces(vs.percent);  

                    fiscalYearFitting += vs.total;
                    fiscalPercentFitting += vs.percent;
                }  

                return acc;  
            }, {})  
        }; 

        
        fittingTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearFitting);
        fittingTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalPercentFitting / 12);

        let lastFiscalFitting = await calculateLastYearFiscal('fittings', tahun - 1, domain);
        fittingTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalFitting);


        let lastFiscalPercentFitting = (denominator === 0) ? 0 : lastFiscalFitting / denominator;
        fittingTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentFitting || 0)

        response.push(fittingTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getRuglue = await fetchComponentData(jenisProduksiGlue, tahun, domain)
        let fiscalYearRuglue = 0;
        let fiscalPercentRuglue = 0;
        const ruglueTotal = {  
            index: 7,  
            description: 'Glue',  
            type: 'subRow',  
            ...getRuglue.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;    
                    const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);
                    acc[monthPercent] = roundToTwoDecimalPlaces(vs.percent);  

                    fiscalYearRuglue += vs.total;
                    fiscalPercentRuglue += vs.percent;
                }  
                
                return acc;  
            }, {})  
        }; 

        ruglueTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearRuglue);
        ruglueTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalPercentRuglue / 12);

        let lastFiscalRuglue = await calculateLastYearFiscal('glue', tahun - 1, domain);
        ruglueTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalRuglue);

        let lastFiscalPercentRuglue = (denominator === 0) ? 0 : lastFiscalRuglue / denominator;
        ruglueTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentRuglue || 0)

        response.push(ruglueTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getOthers = await fetchComponentData(jenisProduksiOther, tahun, domain)
        let fiscalYearOthers = 0;
        let fiscalPercentOthers = 0;
        const otherTotal = {  
            index: 8,  
            description: 'Other',  
            type: 'subRow',  
            ...getOthers.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;    
                    const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);
                    acc[monthPercent] = roundToTwoDecimalPlaces(vs.percent); 
                    
                    fiscalYearOthers += vs.total;
                    fiscalPercentOthers += vs.percent;
                }  
                
                return acc;  
            }, {})  
        }; 

        otherTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearOthers);
        otherTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalPercentOthers / 12);

        let lastFiscalOthers = await calculateLastYearFiscal('others', tahun - 1, domain);
        otherTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalOthers);

        let lastFiscalPercentOthers = (denominator === 0) ? 0 : lastFiscalOthers / denominator;
        otherTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentOthers || 0)

        response.push(otherTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        // Hitung Harga Pokok Penjualan
        const getHPPData = await fetchHPPData(jenisProduksiNonProduksi, jenisProduksiCogsTrading, tahun, domain)
        let fiscalHPP = 0;
        const cogsTotal = {  
            index: 9,  
            description: 'HARGA POKOK PENJUALAN',  
            type: 'mainRow',  
            ...getHPPData.reduce((acc, vs) => { 
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;    
                    const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);
                    acc[monthPercent] = roundToTwoDecimalPlaces(vs.percent);

                    fiscalHPP += vs.total;
                }  

                return acc;  
            }, {})  
        }; 

        cogsTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalHPP);

        const actualFiscalPercentCogs = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : Math.abs(fiscalHPP) / (fiscalPenjualanBruto + fiscalPotonganPenjualan);
        cogsTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(actualFiscalPercentCogs);

        let lastFiscalHPP = await calculateLastYearFiscal('harga pokok penjualan', tahun -1, domain);
        cogsTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalHPP);
        const lastFiscalPercentCogs = denominator === 0 ? 0 : lastFiscalHPP / denominator;
        cogsTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentCogs);

        response.push(cogsTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();
        // Selesai Hitung Harga Pokok Penjualan

        const getTrading = await fetchTradingData(jenisProduksiCogsTrading, tahun, domain)
        let fiscalYearTrading = 0;
        let fiscalPercentTrading = 0;
        const tradingTotal = {  
            index: 10,  
            description: 'Trading',  
            type: 'subRow',  
            ...getTrading.reduce((acc, vs) => { 
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;    
                    const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);
                    acc[monthPercent] = roundToTwoDecimalPlaces(vs.percent);

                    fiscalYearTrading += vs.total;
                    fiscalPercentTrading += vs.percent;
                }  

                return acc;  
            }, {})  
        }; 

        tradingTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearTrading);
        tradingTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalPercentTrading / 12);

        let lastFiscalTrading = await calculateLastYearFiscal('trading', tahun -1, domain);
        tradingTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalTrading);
        const lastFiscalPercentTrading = denominator === 0 ? 0 : lastFiscalTrading / denominator;
        tradingTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentTrading);

        response.push(tradingTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getBox = await fetchBoxData([6180001, 6180002, 6180099], tahun, domain)
        let fiscalYearBox = 0;
        const boxTotal = {  
            index: 11,  
            description: 'Box/Metal Insert/Karet',  
            type: 'subRow',  
            ...getBox.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;    
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  

                    fiscalYearBox += vs.total;
                }  
                
                return acc;  
            }, {})  
        }; 

        boxTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearBox);
        const fiscalYearPercentBox = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : fiscalYearBox / (fiscalPenjualanBruto + fiscalPotonganPenjualan)
        boxTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentBox);

        const lastFiscalBox = await calculateLastYearFiscal('box/metal insert/karet', tahun -1, domain)
        boxTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalBox);

        const lastFiscalPercentBox = denominator === 0 ? 0 : lastFiscalBox / denominator;
        boxTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentBox);

        response.push(boxTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getFOH = await fetchFOHData(tahun, domain);
        let fiscalYearFOH = 0;
        const fohTotal = {  
            index: 12,  
            description: 'FOH',  
            type: 'subRow',  
            ...getFOH.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;    
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);

                    fiscalYearFOH += vs.total;
                }  

                return acc;  
            }, {})  
        };

        fohTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearFOH);
        const fiscalYearPercentFOH = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : fiscalYearFOH / (fiscalPenjualanBruto + fiscalPotonganPenjualan)
        fohTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentFOH);

        const lastFiscalFOH = await calculateLastYearFiscal('foh', tahun -1, domain)
        fohTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalFOH);

        const lastFiscalPercentFOH = denominator === 0 ? 0 : lastFiscalFOH / denominator;
        fohTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentFOH);

        response.push(fohTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        // Perhitungan Beban
        const getBebanPenjualan = await fetchBebanData("beban penjualan & pemasaran", tahun, domain)
        let fiscalYearBebanPenjualan = 0;
        const bebanPenjualanTotal = {  
            index: 14,  
            description: 'Beban Penjualan & Pemasaran',  
            type: 'subRow',  
            ...getBebanPenjualan.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);

                    fiscalYearBebanPenjualan += vs.total;
                }  
                return acc;  
            }, {})  
        }; 

        bebanPenjualanTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearBebanPenjualan);
        const fiscalYearPercentBebanPenjualan = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : fiscalYearBebanPenjualan / (fiscalPenjualanBruto + fiscalPotonganPenjualan)
        bebanPenjualanTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentBebanPenjualan);

        const lastFiscalBebanPenjualan = await calculateLastYearFiscal('beban penjualan & pemasaran', tahun -1, domain)
        bebanPenjualanTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalBebanPenjualan);

        const lastFiscalPercentBebanPenjualan = denominator === 0 ? 0 : lastFiscalBebanPenjualan / denominator;
        bebanPenjualanTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentBebanPenjualan);

        response.push(bebanPenjualanTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getBebanUmum = await fetchBebanData("beban umum & administras", tahun, domain)
        let fiscalYearBebanUmum = 0;
        const bebanUmumTotal = {  
            index: 15,  
            description: 'Beban Umum & Administrasi',  
            type: 'subRow',  
            ...getBebanUmum.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);

                    fiscalYearBebanUmum += vs.total;
                }  
                return acc;  
            }, {})  
        }; 

        bebanUmumTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearBebanUmum);
        const fiscalYearPercentBebanUmum = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : fiscalYearBebanUmum / (fiscalPenjualanBruto + fiscalPotonganPenjualan)
        bebanUmumTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentBebanUmum);

        const lastFiscalBebanUmum = await calculateLastYearFiscal('beban umum & administrasi', tahun -1, domain)
        bebanUmumTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalBebanUmum);

        const lastFiscalPercentBebanUmum = denominator === 0 ? 0 : lastFiscalBebanUmum / denominator;
        bebanUmumTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentBebanUmum);

        response.push(bebanUmumTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getBebanLainnya = await fetchBebanData("beban lainnya", tahun, domain)
        let fiscalYearBebanLainnya = 0;
        const bebanLainnyaTotal = {  
            index: 16,  
            description: 'Beban Lainnya',  
            type: 'subRow',  
            ...getBebanLainnya.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);

                    fiscalYearBebanLainnya += vs.total;
                }  
                return acc;  
            }, {})  
        }; 

        bebanLainnyaTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearBebanLainnya);
        const fiscalYearPercentBebanLainnya = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : fiscalYearBebanLainnya / (fiscalPenjualanBruto + fiscalPotonganPenjualan)
        bebanLainnyaTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentBebanLainnya);

        const lastFiscalBebanLainnya = await calculateLastYearFiscal('beban lainnya', tahun -1, domain)
        bebanLainnyaTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalBebanLainnya);

        const lastFiscalPercentBebanLainnya = denominator === 0 ? 0 : lastFiscalBebanLainnya / denominator;
        bebanLainnyaTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentBebanLainnya);

        response.push(bebanLainnyaTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getPendapatanLainnya = await fetchBebanData("pendapatan lainnya", tahun, domain)
        let fiscalYearPendapatanLainnya = 0;
        const pendapatanLainnyaTotal = {  
            index: 17,  
            description: 'Pendapatan Lainnya',  
            type: 'subRow',  
            ...getPendapatanLainnya.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);

                    fiscalYearPendapatanLainnya += vs.total;
                }  
                return acc;  
            }, {})  
        }; 

        pendapatanLainnyaTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearPendapatanLainnya);
        const fiscalYearPercentPendapatanLainnya = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : fiscalYearPendapatanLainnya / (fiscalPenjualanBruto + fiscalPotonganPenjualan)
        pendapatanLainnyaTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentPendapatanLainnya);

        const lastFiscalPendapatanLainnya = await calculateLastYearFiscal('pendapatan lainnya', tahun -1, domain)
        pendapatanLainnyaTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalPendapatanLainnya);

        const lastFiscalPercentPendapatanLainnya = denominator === 0 ? 0 : lastFiscalPendapatanLainnya / denominator;
        pendapatanLainnyaTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentPendapatanLainnya);

        response.push(pendapatanLainnyaTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getRugiLabaPenjualanAset = await fetchBebanData("Rugi Laba Penjualan Aset", tahun, domain)
        let fiscalRugiLaba = 0;
        const rugiLabaTotal = {  
            index: 18,  
            description: 'Rugi Laba Penjualan Aset',  
            type: 'subRow',  
            ...getRugiLabaPenjualanAset.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);

                    fiscalRugiLaba += vs.total;
                }  
                return acc;  
            }, {})  
        }; 

        rugiLabaTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalRugiLaba);
        const fiscalYearPercentRugiLaba = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : fiscalYearRugiLaba / (fiscalPenjualanBruto + fiscalPotonganPenjualan)
        rugiLabaTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentRugiLaba);

        const lastFiscalRugiLaba = await calculateLastYearFiscal('Rugi Laba Penjualan Aset', tahun -1, domain)
        rugiLabaTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalRugiLaba);

        const lastFiscalPercentRugiLaba = denominator === 0 ? 0 : lastFiscalRugiLaba / denominator;
        rugiLabaTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentRugiLaba);

        response.push(rugiLabaTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getSKPSTP = await fetchBebanData("skp/stp/denda pajak", tahun, domain)
        let fiscalYearSKP = 0;
        const skpTotal = {  
            index: 19,  
            description: 'SKP/STP/Denda Pajak',  
            type: 'subRow',  
            ...getSKPSTP.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);

                    fiscalYearSKP += vs.total;
                }  
                return acc;  
            }, {})  
        }; 

        skpTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearSKP);
        const fiscalYearPercentSKP = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : fiscalYearSKP / (fiscalPenjualanBruto + fiscalPotonganPenjualan)
        skpTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentSKP);

        const lastFiscalSKP = await calculateLastYearFiscal('skp/stp/denda pajak', tahun -1, domain)
        skpTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalSKP);

        const lastFiscalPercentSKP = denominator === 0 ? 0 : lastFiscalSKP / denominator;
        skpTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentSKP);

        response.push(skpTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getPendapatanKeuangan = await fetchBebanData("Pendapatan Keuangan", tahun, domain)
        let fiscalYearPendapatanKeuangan = 0;
        const pendapatanKeuanganTotal = {  
            index: 21,  
            description: 'Pendapatan Keuangan',  
            type: 'subRow',  
            ...getPendapatanKeuangan.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);

                    fiscalYearPendapatanKeuangan += vs.total;
                }  
                return acc;  
            }, {})  
        }; 

        pendapatanKeuanganTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearPendapatanKeuangan);
        const fiscalYearPercentPendapatanKeuangan = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : fiscalYearPendapatanKeuangan / (fiscalPenjualanBruto + fiscalPotonganPenjualan)
        pendapatanKeuanganTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentPendapatanKeuangan);

        const lastFiscalPendapatanKeuangan = await calculateLastYearFiscal('Pendapatan Keuangan', tahun -1, domain)
        pendapatanKeuanganTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalPendapatanKeuangan);

        const lastFiscalPercentPendapatanKeuangan = denominator === 0 ? 0 : lastFiscalPendapatanKeuangan / denominator;
        pendapatanKeuanganTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentPendapatanKeuangan);

        response.push(pendapatanKeuanganTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getPendapatanBeban = await fetchBebanData("pendapatan (beban) selisih kurs", tahun, domain)
        let fiscalYearPendapatanBeban = 0;
        const pendapatanBebanTotal = {  
            index: 22,  
            description: 'Pendapatan (Beban) Selisih Kurs',  
            type: 'subRow',  
            ...getPendapatanBeban.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);

                    fiscalYearPendapatanBeban += vs.total;
                }  
                return acc;  
            }, {})  
        }; 

        pendapatanBebanTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearPendapatanBeban);
        const fiscalYearPercentPendapatanBeban = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : fiscalYearPendapatanBeban / (fiscalPenjualanBruto + fiscalPotonganPenjualan)
        pendapatanBebanTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentPendapatanBeban);

        const lastFiscalPendapatanBeban = await calculateLastYearFiscal('pendapatan (beban) selisih kurs', tahun -1, domain)
        pendapatanBebanTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalPendapatanBeban);

        const lastFiscalPercentPendapatanBeban = denominator === 0 ? 0 : lastFiscalPendapatanBeban / denominator;
        pendapatanBebanTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentPendapatanBeban);

        response.push(pendapatanBebanTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getBebanBunga = await fetchBebanData("beban bunga", tahun, domain)
        let fiscalYearBebanBunga = 0;
        const bebanBungaTotal = {  
            index: 23,  
            description: 'Beban Bunga',  
            type: 'subRow',  
            ...getBebanBunga.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);

                    fiscalYearBebanBunga += vs.total;
                }  
                return acc;  
            }, {})  
        }; 

        bebanBungaTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearBebanBunga);
        const fiscalYearPercentBebanBunga = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : fiscalYearBebanBunga / (fiscalPenjualanBruto + fiscalPotonganPenjualan)
        bebanBungaTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentBebanBunga);

        const lastFiscalBebanBunga = await calculateLastYearFiscal('beban bunga', tahun -1, domain)
        bebanBungaTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalBebanBunga);

        const lastFiscalPercentBebanBunga = denominator === 0 ? 0 : lastFiscalBebanBunga / denominator;
        bebanBungaTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentBebanBunga);

        response.push(bebanBungaTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getBebanBungaSewa = await fetchBebanData("beban bunga sewa", tahun, domain)
        let fiscalBebanBungaSewa = 0;
        const bebanSewaTotal = {  
            index: 24,  
            description: 'Beban Bunga Sewa',  
            type: 'subRow',  
            ...getBebanBungaSewa.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);

                    fiscalBebanBungaSewa += vs.total;
                }  
                return acc;  
            }, {})  
        }; 

        bebanSewaTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalBebanBungaSewa);
        const fiscalYearPercentBebanBungaSewa = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : fiscalYearBebanBungaSewa / (fiscalPenjualanBruto + fiscalPotonganPenjualan)
        bebanSewaTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentBebanBungaSewa);

        const lastFiscalBebanBungaSewa = await calculateLastYearFiscal('beban bunga sewa', tahun -1, domain)
        bebanSewaTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalBebanBungaSewa);

        const lastFiscalPercentBebanBungaSewa = denominator === 0 ? 0 : lastFiscalBebanBungaSewa / denominator;
        bebanSewaTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentBebanBungaSewa);

        response.push(bebanSewaTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        const getpendBebanPajakTangguhan = await fetchBebanData("pendapatan (beban) pajak tangguhan", tahun, domain)
        let fiscalBebanPajakTangguhan = 0;
        const pendBebanPajakTangguhanTotal = {  
            index: 28,  
            description: 'Pendaptan (Beban) Pajak Tangguhan',  
            type: 'subRow',  
            ...getpendBebanPajakTangguhan.reduce((acc, vs) => {  
                const monthName = getMonthName(vs.month);  
                if (monthName) {  
                    const monthKey = `${String(getMonthName(vs.month)).toLowerCase().slice(0, 3)}Value`;    
                    const monthPercent = `${String(getMonthName(vs.month)).toLowerCase().slice(0, 3)}Percent`;
                    acc[monthKey] = roundToTwoDecimalPlaces(vs.total);
                    acc[monthPercent] = 0;

                    fiscalBebanPajakTangguhan += vs.total;
                    return acc;    
                }  
                return acc;  
            }, {})  
        }; 

        pendBebanPajakTangguhanTotal['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalBebanPajakTangguhan);
        const fiscalYearPercentBebanPajakTangguhan = (fiscalPenjualanBruto + fiscalPotonganPenjualan) === 0 ? 0 : fiscalBebanPajakTangguhan / (fiscalPenjualanBruto + fiscalPotonganPenjualan)
        pendBebanPajakTangguhanTotal['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentBebanPajakTangguhan);

        const lastFiscalBebanPajakTangguhan = await calculateLastYearFiscal('pendapatan (beban) pajak tangguhan', tahun -1, domain)
        pendBebanPajakTangguhanTotal['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalBebanPajakTangguhan);

        const lastFiscalPercentBebanPajakTangguhan = denominator === 0 ? 0 : lastFiscalBebanPajakTangguhan / denominator;
        pendBebanPajakTangguhanTotal['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentBebanPajakTangguhan);

        response.push(pendBebanPajakTangguhanTotal);
        checkResponseCompletion(response, res);
        checkIfAllWorkersCompleted();

        setInterval(() => {
            if (!processPenjualanBersih) {
                if(!isEmpty(monthlyTotals) &&    
                    !isEmpty(potonganPenjualanTotals) &&  
                    !isEmpty(pipaTotals) &&
                    !isEmpty(fittingTotal) &&
                    !isEmpty(ruglueTotal) &&
                    !isEmpty(otherTotal) &&
                    !isEmpty(cogsTotal) &&
                    !isEmpty(tradingTotal) &&
                    !isEmpty(boxTotal) &&
                    !isEmpty(fohTotal) &&
                    !isEmpty(bebanPenjualanTotal) &&
                    !isEmpty(bebanUmumTotal) &&
                    !isEmpty(bebanLainnyaTotal) &&
                    !isEmpty(pendapatanLainnyaTotal) &&
                    !isEmpty(rugiLabaTotal) &&
                    !isEmpty(skpTotal) &&
                    !isEmpty(pendapatanKeuanganTotal) &&
                    !isEmpty(pendapatanBebanTotal) &&
                    !isEmpty(bebanBungaTotal) &&
                    !isEmpty(bebanSewaTotal) &&
                    !isEmpty(pendBebanPajakTangguhanTotal)){
                    penjualanBersih();
                }
            }  
        }, 1000);
        
        // setTimeout(() => {  
        //     clearInterval(intervalId);  
        // }, 30000);  
    
        // After all workers are done, create the new index 4    
        const penjualanBersih = async() => {  
            if(processPenjualanBersih) return;  
            processPenjualanBersih = true;

            const summaryRow = {    
                index: 4,    
                description: 'PENJUALAN BERSIH',  
                type: 'mainRow',    
            };    
    
            let fiscalPenjualanBersih = 0;
            for(let i = 1; i <= 12; i++){
                const month = getMonthName(i).toLowerCase();
                const monthKey = `${String(month).slice(0, 3)}Value`
                const totalValue = (monthlyTotals[monthKey] || 0) + (potonganPenjualanTotals[monthKey] || 0);    
                summaryRow[monthKey] = totalValue;    
                summaryRow[`${String(monthKey).slice(0, 3)}Percent`] = 100;

                fiscalPenjualanBersih += (monthlyTotals[monthKey] || 0) + (potonganPenjualanTotals[monthKey] || 0);
            }
            
            summaryRow['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalPenjualanBersih);
            summaryRow['actualFiscalPercent'] = 100;

            summaryRow['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalPenjualanBruto - lastFiscalPotonganPenjualan);
            summaryRow['lastFiscalPercent'] = 100;

            response.push(summaryRow);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted()

            response.forEach((item) => {
                if(item.index === 3){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase();
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(monthlyTotals[monthKey] / potonganPenjualanTotals[monthKey])
                    }

                    checkResponseCompletion(response, res);
                }
            })

            const find = response.filter((data) => {
                return data.index === 3
            });

            response.forEach((item) => {
                if(item.index === 2){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase();
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(summaryRow[`${String(monthKey).slice(0, 3)}Percent`] - find[0][`${String(monthKey).slice(0, 3)}Percent`])
                    }

                    checkResponseCompletion(response, res);
                }
            })

            const findPenjualanBersih = response.filter((data) => data.index === 4);

            response.forEach((item) => {
                if(item.index === 11){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase();
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(item[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]); 
                    }

                    checkResponseCompletion(response, res);
                }
            })

            response.forEach((item) => {
                if(item.index === 12){
                    Object.keys(item).forEach(monthKey => {  
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(item[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]); 
                    });

                    checkResponseCompletion(response, res);
                }
            })

            const rawMaterial = {    
                index: 10.5,    
                description: 'Raw Material',  
                type: 'subRow',    
            };    
    
            let fiscalYearRawMaterial = 0;
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                rawMaterial[`${String(monthKey).slice(0, 3)}Value`] = roundToTwoDecimalPlaces(1 * -(cogsTotal[`${String(monthKey).slice(0, 3)}Value`] + boxTotal[`${String(monthKey).slice(0, 3)}Value`] + tradingTotal[`${String(monthKey).slice(0, 3)}Value`]));
                rawMaterial[`${String(monthKey).slice(0, 3)}Percent`] = 0;

                fiscalYearRawMaterial += 1 * -(cogsTotal[`${String(monthKey).slice(0, 3)}Value`] + boxTotal[`${String(monthKey).slice(0, 3)}Value`] + tradingTotal[`${String(monthKey).slice(0, 3)}Value`]);
            }

            rawMaterial['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearRawMaterial);
            rawMaterial['actualFiscalPercent'] = 0;

            const lastFiscalYearRawMaterial = lastFiscalHPP - lastFiscalFOH - lastFiscalBox - lastFiscalTrading;
            rawMaterial['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalYearRawMaterial);
            rawMaterial['lastFiscalPercent'] = 0;
            
            response.push(rawMaterial);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted()

            const labaUsaha = {    
                index: 20,    
                description: 'Laba Usaha',  
                type: 'highlight',    
            };

            const labaKotor = {    
                index: 13,    
                description: 'Laba Kotor',  
                type: 'highlight',    
            };    
    
            let fiscalYearValueLabaKotor = 0;
            let fiscalYearPercentLabaKotor = 0;
            response.forEach((item) => {
                if(item.index === 9){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase();
                        labaKotor[`${String(monthKey).slice(0, 3)}Value`] = roundToTwoDecimalPlaces(findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`] - item[`${String(monthKey).slice(0, 3)}Value`]);
                        labaKotor[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Percent`] + item[`${String(monthKey).slice(0, 3)}Percent`]);

                        fiscalYearValueLabaKotor += findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`] - item[`${String(monthKey).slice(0, 3)}Value`]
                        fiscalYearPercentLabaKotor += findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Percent`] + item[`${String(monthKey).slice(0, 3)}Percent`]

                        labaUsaha[`${String(monthKey).slice(0, 3)}Value`] = findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`] - item[`${String(monthKey).slice(0, 3)}Value`];
                    }
                }
            })

            labaKotor['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearValueLabaKotor);
            labaKotor['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentLabaKotor / 12);

            const lastFiscalLabaKotor = denominator + lastFiscalHPP;
            labaKotor['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalLabaKotor);

            const lastFiscalPercentLabaKotor = 100 + lastFiscalPercentCogs;
            labaKotor['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentLabaKotor);

            response.push(labaKotor);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();

            response.forEach((item) => {
                if(item.index === 14){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase(); 
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(item[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]);

                        labaUsaha[`${String(monthKey).slice(0, 3)}Value`] += item[`${String(monthKey).slice(0, 3)}Value`];
                    };

                    checkResponseCompletion(response, res);
                }
            })

            response.forEach((item) => {
                if(item.index === 15){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase();
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(item[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]); 
                        
                        labaUsaha[`${String(monthKey).slice(0, 3)}Value`] += item[`${String(monthKey).slice(0, 3)}Value`];
                    };

                    checkResponseCompletion(response, res);
                }
            })

            response.forEach((item) => {
                if(item.index === 16){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase() 
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(item[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]); 
                    
                        labaUsaha[`${String(monthKey).slice(0, 3)}Value`] += item[`${String(monthKey).slice(0, 3)}Value`];
                    };

                    checkResponseCompletion(response, res);
                }
            })

            response.forEach((item) => {
                if(item.index === 17){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase(); 
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(item[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]); 
                    
                        labaUsaha[`${String(monthKey).slice(0, 3)}Value`] += item[`${String(monthKey).slice(0, 3)}Value`];
                    };

                    checkResponseCompletion(response, res);
                }
            })

            response.forEach((item) => {
                if(item.index === 18){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase(); 
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(item[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]); 
                    
                        labaUsaha[`${String(monthKey).slice(0, 3)}Value`] += item[`${String(monthKey).slice(0, 3)}Value`];
                    };

                    checkResponseCompletion(response, res);
                }
            })

            response.forEach((item) => {
                if(item.index === 19){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase(); 
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(item[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]); 
                    
                        labaUsaha[`${String(monthKey).slice(0, 3)}Value`] += item[`${String(monthKey).slice(0, 3)}Value`];
                    };

                    checkResponseCompletion(response, res);
                }
            })

            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                labaUsaha[`${String(monthKey).slice(0, 3)}Value`] = roundToTwoDecimalPlaces(labaUsaha[`${String(monthKey).slice(0, 3)}Value`]);
                labaUsaha[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(labaUsaha[`${String(monthKey).slice(0, 3)}Percent`]);
            }

            response.push(labaUsaha)
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();

            let fiscalYearLabaUsaha = 0;
            let fiscalYearPercentLabaUsaha = 0;
            response.forEach((item) => {
                if(item.index === 20){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase();
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(item[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]); 
                        
                        fiscalYearLabaUsaha += item[`${String(monthKey).slice(0, 3)}Value`]
                        fiscalYearPercentLabaUsaha += item[`${String(monthKey).slice(0, 3)}Percent`]
                    };

                    checkResponseCompletion(response, res);
                }
            })

            let lastFiscalLabaUsaha = 0;
            response.forEach((item) => {
                if(item.index === 20){
                    item['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearLabaUsaha);
                    item['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentLabaUsaha / 12);
        
                    lastFiscalLabaUsaha = lastFiscalLabaKotor + lastFiscalBebanPenjualan + lastFiscalBebanUmum + lastFiscalBebanLainnya + lastFiscalPendapatanLainnya + lastFiscalRugiLaba + lastFiscalSKP;
                    item['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalLabaUsaha);
        
                    const lastFiscalPercentLabaUsaha = denominator === 0 ? 0 : lastFiscalLabaUsaha / denominator;
                    item['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentLabaUsaha);
                }
            })

            const pendBebanDiLuarUsaha = {    
                index: 25,    
                description: 'Pendapatan (Beban) Diluar Usaha',  
                type: 'highlight',    
            };

            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                pendBebanDiLuarUsaha[`${String(monthKey).slice(0, 3)}Value`] = 0;
                pendBebanDiLuarUsaha[`${String(monthKey).slice(0, 3)}Percent`] = 0;
            }

            response.forEach((item) => {
                if(item.index === 21){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase();
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(item[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]); 
                        
                        pendBebanDiLuarUsaha[`${String(monthKey).slice(0, 3)}Value`] += item[`${String(monthKey).slice(0, 3)}Value`];
                    };

                    checkResponseCompletion(response, res);
                }
            })

            response.forEach((item) => {
                if(item.index === 22){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase(); 
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(item[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]); 
                    
                        pendBebanDiLuarUsaha[`${String(monthKey).slice(0, 3)}Value`] += item[`${String(monthKey).slice(0, 3)}Value`];
                    };

                    checkResponseCompletion(response, res);
                }
            })

            response.forEach((item) => {
                if(item.index === 23){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase();  
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(item[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]); 
                        pendBebanDiLuarUsaha[`${String(monthKey).slice(0, 3)}Value`] += item[`${String(monthKey).slice(0, 3)}Value`];
                    };

                    checkResponseCompletion(response, res);
                }
            })

            response.forEach((item) => {
                if(item.index === 24){
                    for(let i = 1; i <= 12; i++){
                        const monthKey = getMonthName(i).toLowerCase(); 
                        item[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(item[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]); 
                        pendBebanDiLuarUsaha[`${String(monthKey).slice(0, 3)}Value`] += item[`${String(monthKey).slice(0, 3)}Value`];
                    };

                    checkResponseCompletion(response, res);
                }
            })

            let fiscalYearPendBebanDiLuarUsaha = 0;
            let fiscalYearPercentPendBebanDiLuarUsaha = 0;
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                pendBebanDiLuarUsaha[`${String(monthKey).slice(0, 3)}Value`] = roundToTwoDecimalPlaces(pendBebanDiLuarUsaha[`${String(monthKey).slice(0, 3)}Value`]);
                pendBebanDiLuarUsaha[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(Math.abs(pendBebanDiLuarUsaha[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]));
                
                fiscalYearPendBebanDiLuarUsaha += pendBebanDiLuarUsaha[`${String(monthKey).slice(0, 3)}Value`];
                fiscalYearPercentPendBebanDiLuarUsaha += pendBebanDiLuarUsaha[`${String(monthKey).slice(0, 3)}Percent`];
            }

            pendBebanDiLuarUsaha['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearPendBebanDiLuarUsaha);
            pendBebanDiLuarUsaha['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentPendBebanDiLuarUsaha / 12);

            const lastFiscalPendBebanDiLuarUsaha = lastFiscalPendapatanKeuangan + lastFiscalPercentPendapatanBeban + lastFiscalBebanBunga + lastFiscalBebanBungaSewa;
            pendBebanDiLuarUsaha['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalPendBebanDiLuarUsaha);

            const lastFiscalPercentPendBebanDiLuarUsaha = denominator === 0 ? 0 : lastFiscalPendBebanDiLuarUsaha / denominator;
            pendBebanDiLuarUsaha['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentPendBebanDiLuarUsaha);

            response.push(pendBebanDiLuarUsaha);  
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();

            const labaSebelumPajak = {    
                index: 26,    
                description: 'Laba Sebelum Pajak Penghasilan',  
                type: 'highlight',    
            };

            let fiscalYearLabaSebelumPajak = 0;
            let fiscalYearPercentLabaSebelumPajak = 0;
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                labaSebelumPajak[`${String(monthKey).slice(0, 3)}Value`] = roundToTwoDecimalPlaces(labaUsaha[`${String(monthKey).slice(0, 3)}Value`] + pendBebanDiLuarUsaha[`${String(monthKey).slice(0, 3)}Value`]);
                labaSebelumPajak[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(Math.abs(labaSebelumPajak[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]));
                
                fiscalYearLabaSebelumPajak += labaSebelumPajak[`${String(monthKey).slice(0, 3)}Value`]
                fiscalYearPercentLabaSebelumPajak += labaSebelumPajak[`${String(monthKey).slice(0, 3)}Percent`]
            }

            labaSebelumPajak['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearLabaSebelumPajak);
            labaSebelumPajak['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentLabaSebelumPajak / 12);

            const lastFiscalLabaSebelumPajak = lastFiscalLabaUsaha + lastFiscalPendBebanDiLuarUsaha;
            labaSebelumPajak['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalLabaSebelumPajak);

            const lastFiscalPercentLabaSebelumPajak = denominator === 0 ? 0 : lastFiscalLabaSebelumPajak / denominator;
            labaSebelumPajak['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentLabaSebelumPajak);

            response.push(labaSebelumPajak);  
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();

            const bebanPajakKini = {    
                index: 27,    
                description: 'Beban Pajak Kini',  
                type: 'subRow',    
            };

            let fiscalYearBebanPajakKini = 0;
            let fiscalYearPercentBebanPajakKini = 0;
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                if(labaSebelumPajak[`${String(monthKey).slice(0, 3)}Value`] > 0){
                    bebanPajakKini[`${String(monthKey).slice(0, 3)}Value`] = roundToTwoDecimalPlaces((-labaSebelumPajak[`${String(monthKey).slice(0, 3)}Value`]) * (22 / 100));
                } else bebanPajakKini[`${String(monthKey).slice(0, 3)}Value`] = 0;
                
                bebanPajakKini[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(bebanPajakKini[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]);
                
                fiscalYearBebanPajakKini += bebanPajakKini[`${String(monthKey).slice(0, 3)}Value`];
                fiscalYearPercentBebanPajakKini += bebanPajakKini[`${String(monthKey).slice(0, 3)}Percent`];
            }

            bebanPajakKini['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearBebanPajakKini);
            bebanPajakKini['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentBebanPajakKini / 12);

            const lastFiscalBebanPajakKini = lastFiscalLabaSebelumPajak < 0 ? 0 : (-lastFiscalLabaSebelumPajak * (22 / 100));
            bebanPajakKini['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalBebanPajakKini);

            const lastFiscalPercentBebanPajakKini = denominator === 0 ? 0 : lastFiscalBebanPajakKini / denominator;
            bebanPajakKini['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentBebanPajakKini);

            response.push(bebanPajakKini);  
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();

            const labaSetelahPajakPenghasilan = {    
                index: 29,    
                description: 'Laba Setalah Pajak Penghasilan',  
                type: 'highlight',    
            };

            let fiscalYearLabaSetelahPenghasilan = 0;
            let fiscalYearPercentLabaSetelahPenghasilan = 0;
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                labaSetelahPajakPenghasilan[`${String(monthKey).slice(0, 3)}Value`] = roundToTwoDecimalPlaces(labaSebelumPajak[`${String(monthKey).slice(0, 3)}Value`] + bebanPajakKini[`${String(monthKey).slice(0, 3)}Value`] + pendBebanPajakTangguhanTotal[`${String(monthKey).slice(0, 3)}Value`]);    
                labaSetelahPajakPenghasilan[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(labaSebelumPajak[`${String(monthKey).slice(0, 3)}Value`] / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]);
                
                fiscalYearLabaSetelahPenghasilan += labaSetelahPajakPenghasilan[`${String(monthKey).slice(0, 3)}Value`];
                fiscalYearPercentLabaSetelahPenghasilan += labaSetelahPajakPenghasilan[`${String(monthKey).slice(0, 3)}Percent`];
            }

            labaSetelahPajakPenghasilan['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearLabaSetelahPenghasilan);
            labaSetelahPajakPenghasilan['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentLabaSetelahPenghasilan / 12);

            const lastFiscalLabaSetelahPenghasilan = lastFiscalBebanPajakKini + lastFiscalBebanPajakTangguhan;
            labaSetelahPajakPenghasilan['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalLabaSetelahPenghasilan);

            const lastFiscalPercentLabaSetelahPenghasilan = denominator === 0 ? 0 : lastFiscalLabaSetelahPenghasilan / denominator;
            labaSetelahPajakPenghasilan['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentLabaSetelahPenghasilan);

            response.push(labaSetelahPajakPenghasilan);  
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();

            const penghasilanBebanKomperhensifLain = {    
                index: 30,    
                description: 'Penghasilan (Beban) Komperhensif Lain',  
                type: 'subRow',    
            };
    
            let fiscalYearPenghasilanBebanKomperhensifLain = 0;
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                penghasilanBebanKomperhensifLain[`${String(monthKey).slice(0, 3)}Value`] = roundToTwoDecimalPlaces(0);    
                penghasilanBebanKomperhensifLain[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces(0);

                fiscalYearPenghasilanBebanKomperhensifLain += penghasilanBebanKomperhensifLain[`${String(monthKey).slice(0, 3)}Value`]
            }

            penghasilanBebanKomperhensifLain['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearPenghasilanBebanKomperhensifLain);
            penghasilanBebanKomperhensifLain['actualFiscalPercent'] = roundToTwoDecimalPlaces(0);

            const lastFiscalPenghasilanBebanKomperhensifLain = await calculateLastYearFiscal('Penghasilan (Beban) Komperhensif Lain', tahun - 1, domain);
            penghasilanBebanKomperhensifLain['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalPenghasilanBebanKomperhensifLain);
            penghasilanBebanKomperhensifLain['lastFiscalPercent'] = roundToTwoDecimalPlaces(0);
    
            response.push(penghasilanBebanKomperhensifLain);  
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();

            const labaRugiBersihKomperhensif = {    
                index: 31,    
                description: 'Laba (Rugi) Bersih Komperhensif',  
                type: 'single',    
            };
    
            let fiscalYearLabaRugiBersihKomperhensif = 0;
            let fiscalYearPercentLabaRugiBersihKomperhensif = 0;
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                labaRugiBersihKomperhensif[`${String(monthKey).slice(0, 3)}Value`] = roundToTwoDecimalPlaces(labaSetelahPajakPenghasilan[`${String(monthKey).slice(0, 3)}Value`] + penghasilanBebanKomperhensifLain[`${String(monthKey).slice(0, 3)}Value`]);    
                labaRugiBersihKomperhensif[`${String(monthKey).slice(0, 3)}Percent`] = roundToTwoDecimalPlaces((labaSetelahPajakPenghasilan[`${String(monthKey).slice(0, 3)}Value`] + penghasilanBebanKomperhensifLain[`${String(monthKey).slice(0, 3)}Value`]) / findPenjualanBersih[0][`${String(monthKey).slice(0, 3)}Value`]);
            
                fiscalYearLabaRugiBersihKomperhensif += labaRugiBersihKomperhensif[`${String(monthKey).slice(0, 3)}Value`];
                fiscalYearPercentLabaRugiBersihKomperhensif += labaRugiBersihKomperhensif[`${String(monthKey).slice(0, 3)}Percent`];
            }

            labaRugiBersihKomperhensif['actualFiscalValue'] = roundToTwoDecimalPlaces(fiscalYearLabaRugiBersihKomperhensif);
            labaRugiBersihKomperhensif['actualFiscalPercent'] = roundToTwoDecimalPlaces(fiscalYearPercentLabaRugiBersihKomperhensif / 12);

            const lastFiscalLabaRugiBersihKomperhensif = lastFiscalLabaSetelahPenghasilan + lastFiscalPenghasilanBebanKomperhensifLain;
            labaRugiBersihKomperhensif['lastFiscalValue'] = roundToTwoDecimalPlaces(lastFiscalLabaRugiBersihKomperhensif);

            const lastFiscalPercentLabaRugiBersihKomperhensif= denominator === 0 ? 0 : lastFiscalLabaRugiBersihKomperhensif / denominator;
            labaRugiBersihKomperhensif['lastFiscalPercent'] = roundToTwoDecimalPlaces(lastFiscalPercentLabaRugiBersihKomperhensif);
    
            response.push(labaRugiBersihKomperhensif);  
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();

            const labaRugiSebelumPajak = {    
                index: 32,   
                description: 'Laba (Rugi) Sebelum Pajak',  
                type: 'singleMain',
            };
    
            let totalLabaRugiSebelumPajak = 0;
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                totalLabaRugiSebelumPajak += labaSetelahPajakPenghasilan[`${String(monthKey).slice(0, 3)}Value`];    
            }

            labaRugiSebelumPajak['janValue'] = totalLabaRugiSebelumPajak;
    
            response.push(labaRugiSebelumPajak);  
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();

            // Start Tax Report
            const temporaryRow = {    
                index: 33,    
                description: 'Temporary Difference',  
                type: 'singleMain',    
            };    
            
            response.push(temporaryRow);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getProvisionEmployeeBenefits = await fetchTaxData("provision for employee benefits", tahun, domain)
            const provisionEmployeeBenefitsTotal = {  
                index: 34,  
                description: 'Provision for employee benefits',  
                type: 'singleSub',  
                ...getProvisionEmployeeBenefits.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            };          
    
            response.push(provisionEmployeeBenefitsTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getprovisionBonus = await fetchTaxData( "provision for bonus - accrue bonus", tahun, domain)
            const provisionBonusTotal = {  
                index: 35,  
                description: 'Provision for bonus - accrue bonus',  
                type: 'singleSub',  
                ...getprovisionBonus.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(provisionBonusTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getProvisionTHR = await fetchTaxData("provision for thr - accrue thr", tahun, domain)
            const provisionTHRTotal = {  
                index: 36,  
                description: 'Provision for THR - accrue THR',  
                type: 'singleSub',  
                ...getProvisionTHR.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(provisionTHRTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getProvisionAdvertising = await fetchTaxData("provision for advertising expense", tahun, domain)
            const provisionAdvertisingTotal = {  
                index: 37,  
                description: 'Provision for advertising expense',  
                type: 'singleSub',  
                ...getProvisionAdvertising.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(provisionAdvertisingTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getImpairmentLosses = await fetchTaxData("impairment losses", tahun, domain)
            const impairmentLossesTotal = {  
                index: 38,  
                description: 'Impairment losses',  
                type: 'singleSub',  
                ...getImpairmentLosses.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(impairmentLossesTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const diffBetweenRow = {    
                index: 39,    
                description: 'Difference between FA commercial & fiscal',  
                type: 'singleMain',    
            };    
            
            response.push(diffBetweenRow);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getDereciation = await fetchTaxData("depreciation", tahun, domain)
            const depreciationTotal = {  
                index: 40,  
                description: 'Depreciation',  
                type: 'singleSub',  
                ...getDereciation.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(depreciationTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getGainLoss = await fetchTaxData("Gain/loss on sale of FA", tahun, domain)
            const gainLossTotal = {  
                index: 42,  
                description: 'Gain/loss on sale of FA',  
                type: 'singleSub',  
                ...getGainLoss.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(gainLossTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getProvisionDecline = await fetchTaxData("Provision for decline in value of inventory", tahun, domain)
            const provisionDeclineTotal = {  
                index: 43,  
                description: 'Provision for decline in value of inventory',  
                type: 'singleSub',  
                ...getProvisionDecline.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(provisionDeclineTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getProvisionReversal = await fetchTaxData("Provision (reversal) of reveivables", tahun, domain)
            const provisionReversalTotal = {  
                index: 44,  
                description: 'Provision (reversal) of reveivables',  
                type: 'singleSub',  
                ...getProvisionReversal.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(provisionReversalTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getTaxBungaSewa = await fetchTaxData("Bunga sewa", tahun, domain)
            const taxBungaSewaTotal = {  
                index: 45,  
                description: 'Bunga sewa',  
                type: 'singleSub',  
                ...getTaxBungaSewa.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(taxBungaSewaTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getBiayaSewaKendaraan = await fetchTaxData("Biaya sewa kendaraan", tahun, domain)
            const biayaSewaKendaraanTotal = {  
                index: 46,  
                description: 'Biaya sewa kendaraan',  
                type: 'singleSub',  
                ...getBiayaSewaKendaraan.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(biayaSewaKendaraanTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getDepreciationSewa = await fetchTaxData("Depreciation Sewa", tahun, domain)
            const depreciationSewaTotal = {  
                index: 47,  
                description: 'Depreciation Sewa',  
                type: 'singleSub',  
                ...getDepreciationSewa.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(depreciationSewaTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getGainLossTransfer = await fetchTaxData("Gain/loss transfer of lease assets", tahun, domain)
            const gainLossTransferTotal = {  
                index: 48,  
                description: 'Gain/loss transfer of lease assets',  
                type: 'singleSub',  
                ...getGainLossTransfer.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(gainLossTransferTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getPrepaidRent = await fetchTaxData("Prepaid rent", tahun, domain)
            const prepaidRentTotal = {  
                index: 49,  
                description: 'Prepaid rent',  
                type: 'singleSub',  
                ...getPrepaidRent.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(prepaidRentTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getLeaseAsset = await fetchTaxData("Lease Asset (ROU)", tahun, domain)
            const leaseAssetTotal = {  
                index: 50,  
                description: 'Lease Asset (ROU)',  
                type: 'singleSub',  
                ...getLeaseAsset.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(leaseAssetTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getLeaseLiabilities = await fetchTaxData("Lease liabilities", tahun, domain)
            const leaseLiabilitiesTotal = {  
                index: 51,  
                description: 'Lease Liabilities',  
                type: 'singleSub',  
                ...getLeaseLiabilities.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(leaseLiabilitiesTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getTenagaAhli = await fetchTaxData("Tenaga Ahli", tahun, domain)
            const tenagaAhliTotal = {  
                index: 52,  
                description: 'Tenaga Ahli',  
                type: 'singleSub',  
                ...getTenagaAhli.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(tenagaAhliTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getInsentifPenjualan = await fetchTaxData("Insentif Penjualan", tahun, domain)
            const insentifPenjualanTotal = {  
                index: 53,  
                description: 'Insentif Penjualan',  
                type: 'singleSub',  
                ...getInsentifPenjualan.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(insentifPenjualanTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const totalTemporaryDiffRow = {    
                index: 54,    
                description: 'Total Temporary Difference',  
                type: 'singleMain',    
            };
    
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                totalTemporaryDiffRow[`${String(monthKey).slice(0, 3)}Value`] = roundToTwoDecimalPlaces(
                    provisionEmployeeBenefitsTotal[`${String(monthKey).slice(0, 3)}Value`] + 
                    provisionBonusTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    provisionTHRTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    provisionAdvertisingTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    impairmentLossesTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    depreciationTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    gainLossTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    provisionDeclineTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    provisionReversalTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    taxBungaSewaTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    biayaSewaKendaraanTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    depreciationSewaTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    gainLossTransferTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    prepaidRentTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    leaseAssetTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    leaseLiabilitiesTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    tenagaAhliTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    insentifPenjualanTotal[`${String(monthKey).slice(0, 3)}Value`]
                );
    
                totalTemporaryDiffRow[`${String(monthKey).slice(0, 3)}Percent`] = '';
            }
    
            response.push(totalTemporaryDiffRow);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const permanentRow = {    
                index: 55,    
                description: 'Permanent Difference',  
                type: 'singleMain',    
            };
    
            response.push(permanentRow);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getAdvertisingPromotion = await fetchTaxData("Advertising & promotion (NDE)", tahun, domain)
            const advertisingPromotionTotal = {  
                index: 56,  
                description: 'Advertising & promotion (NDE)',  
                type: 'singleSub',  
                ...getAdvertisingPromotion.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(advertisingPromotionTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getRepresentationEntertainment = await fetchTaxData("Representation & Entertainment", tahun, domain)
            const representationEntertainmentTotal = {  
                index: 57,  
                description: 'Representation & Entertainment',  
                type: 'singleSub',  
                ...getRepresentationEntertainment.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(representationEntertainmentTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getTaxExpense = await fetchTaxData("Tax expense", tahun, domain)
            const taxExpenseTotal = {  
                index: 58,  
                description: 'Tax expense',  
                type: 'singleSub',  
                ...getTaxExpense.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(taxExpenseTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getBebanPph21 = await fetchTaxData("Beban pph 21 natura", tahun, domain)
            const bebanPph21Total = {  
                index: 59,  
                description: 'Beban pph 21 natura',  
                type: 'singleSub',  
                ...getBebanPph21.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(bebanPph21Total);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getVehicle = await fetchTaxData("Vehicle (NDE)", tahun, domain)
            const vechileTotal = {  
                index: 61,  
                description: 'Vehicle (NDE)',  
                type: 'singleSub',  
                ...getVehicle.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(vechileTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getTaxOthers = await fetchTaxData("Others", tahun, domain)
            const taxOtherTotal = {  
                index: 62,  
                description: 'Others',  
                type: 'singleSub',  
                ...getTaxOthers.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(taxOtherTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getTaxOthersExpense = await fetchTaxData("Other expense", tahun, domain)
            const taxOtherExpenseTotal = {  
                index: 63,  
                description: 'Other expense',  
                type: 'singleSub',  
                ...getTaxOthersExpense.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(taxOtherExpenseTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getDividend = await fetchTaxData("Dividend", tahun, domain)
            const dividendTotal = {  
                index: 64,  
                description: 'Dividend',  
                type: 'singleSub',  
                ...getDividend.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(dividendTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getInterestFinalTax = await fetchTaxData("Interest income (final tax)", tahun, domain)
            const interestFinalTaxTotal = {  
                index: 65,  
                description: 'Interest income (final tax)',  
                type: 'singleSub',  
                ...getInterestFinalTax.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(interestFinalTaxTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getInterestIncome= await fetchTaxData("Interest income deposito", tahun, domain)
            const interestIncomeTotal = {  
                index: 66,  
                description: 'Interest income deposito',  
                type: 'singleSub',  
                ...getInterestIncome.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(interestIncomeTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getInterestExpense = await fetchTaxData("Interest expense", tahun, domain)
            const interestExpenseTotal = {  
                index: 67,  
                description: 'Interest expense',  
                type: 'singleSub',  
                ...getInterestExpense.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(interestExpenseTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getRentIncome = await fetchTaxData("Rent income (net with tax expense 4(2))", tahun, domain)
            const rentIncomeTotal = {  
                index: 68,  
                description: 'Rent income (net with tax expense 4(2))',  
                type: 'singleSub',  
                ...getRentIncome.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(rentIncomeTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getDepreciationInvestment = await fetchTaxData("Depreciation of investment property", tahun, domain)
            const depreciationInvestmentTotal = {  
                index: 69,  
                description: 'Depreciation of investment property',  
                type: 'singleSub',  
                ...getDepreciationInvestment.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(depreciationInvestmentTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const totalPermanentDiff = {    
                index: 70,    
                description: 'Total permanent difference',  
                type: 'singleMain',    
            };
    
            let totalPermanentDifference = 0;
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                totalPermanentDifference += 
                    advertisingPromotionTotal[`${String(monthKey).slice(0, 3)}Value`] + 
                    representationEntertainmentTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    taxExpenseTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    bebanPph21Total[`${String(monthKey).slice(0, 3)}Value`] +
                    vechileTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    taxOtherTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    taxOtherExpenseTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    dividendTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    interestFinalTaxTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    interestIncomeTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    interestExpenseTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    rentIncomeTotal[`${String(monthKey).slice(0, 3)}Value`] +
                    depreciationInvestmentTotal[`${String(monthKey).slice(0, 3)}Value`];
    
                totalPermanentDiff[`${String(monthKey).slice(0, 3)}Percent`] = '';
            }

            totalPermanentDiff['janValue'] = roundToTwoDecimalPlaces(totalPermanentDifference);
    
            response.push(totalPermanentDiff);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const taxableIncomeRow = {    
                index: 71,    
                description: 'Taxable Income (LOSS)',  
                type: 'singleMain',    
            };
    
            let totalTaxableIncome = totalLabaRugiSebelumPajak + totalPermanentDifference;
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                totalTaxableIncome += totalTemporaryDiffRow[`${String(monthKey).slice(0, 3)}Value`]
                taxableIncomeRow[`${String(monthKey).slice(0, 3)}Percent`] = '';
            }    

            taxableIncomeRow[`janValue`] = roundToTwoDecimalPlaces(totalTaxableIncome);
    
            response.push(taxableIncomeRow);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const fiscalLossRow = {    
                index: 72,    
                description: 'Fiscal Loss',  
                type: 'singleMain',    
            };
    
            let totalFiscalLoss = 0;
            if(totalTaxableIncome < 0 ){
                totalFiscalLoss = totalTaxableIncome;
            } else totalFiscalLoss = 0;

            fiscalLossRow['janValue'] = totalFiscalLoss;
    
            response.push(fiscalLossRow);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const pembulatanRow = {    
                index: 73,    
                description: 'Pembulatan',  
                type: 'singleSub',    
            };

            let totalPembulatan = (totalTaxableIncome / 1000) * 1000;
            pembulatanRow[`janValue`] = totalPembulatan;
    
            response.push(pembulatanRow);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const totalTaxExpenseRow = {    
                index: 74,    
                description: 'Total tax expense',  
                type: 'singleSub',    
            };
    
            let totalTaxExpense = 0;
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                totalTaxExpense += taxExpenseTotal[`${String(monthKey).slice(0, 3)}Value`]
            }

            totalTaxExpenseRow[`janValue`] = totalTaxExpense * totalPembulatan;
    
            response.push(totalTaxExpenseRow);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getPerBook = await fetchTaxData("per book", tahun, domain)
            const perBookTotal = {  
                index: 75,  
                description: 'per book',  
                type: 'singleSub',  
                ...getPerBook.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(perBookTotal);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const diffRow = {    
                index: 76,    
                description: 'Diff',  
                type: 'singleSub',    
            };
    
            let totalDiff = 0;
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                totalDiff += perBookTotal[`${String(monthKey).slice(0, 3)}Value`];
            }

            diffRow['janValue'] = totalDiff * totalTaxExpense; 
    
            response.push(diffRow);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();

            const prepaidTaxRow = {    
                index: 76.5,    
                description: 'Prepaid Tax',  
                type: 'singleMain',    
            };

            response.push(prepaidTaxRow);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getPph22 = await fetchTaxData("PPh Art 22", tahun, domain)
            const pph22Total = {  
                index: 77,  
                description: 'PPh Art 22',  
                type: 'singleSub',  
                ...getPph22.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(pph22Total);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getPph23 = await fetchTaxData("PPh Art 23", tahun, domain)
            const pph23Total = {  
                index: 78,  
                description: 'PPh Art 23',  
                type: 'singleSub',  
                ...getPph23.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(pph23Total);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const getPph25 = await fetchTaxData("PPh Art 25", tahun, domain)
            const pph25Total = {  
                index: 79,  
                description: 'PPh Art 25',  
                type: 'singleSub',  
                ...getPph25.reduce((acc, vs) => {  
                    const monthName = getMonthName(vs.month);  
                    if (monthName) {  
                        const monthKey = `${monthName.toLowerCase().slice(0, 3)}Value`;  
                        const monthPercent = `${monthName.toLowerCase().slice(0, 3)}Percent`;  
              
                        acc[monthKey] = roundToTwoDecimalPlaces(vs.total);  
                        acc[monthPercent] = ''; 
                    }  
                    return acc;  
                }, {})  
            }; 
    
            response.push(pph25Total);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const totalPrepaidTaxRow = {    
                index: 80,    
                description: 'Total Prepaid Tax',  
                type: 'singleMain',    
            };
    
            for(let i = 1; i <= 12; i++){
                const monthKey = getMonthName(i).toLowerCase();
                totalPrepaidTaxRow[`${String(monthKey).slice(0, 3)}Value`] = roundToTwoDecimalPlaces(
                    pph22Total[`${String(monthKey).slice(0, 3)}Value`] + 
                    pph23Total[`${String(monthKey).slice(0, 3)}Value`] +
                    pph25Total[`${String(monthKey).slice(0, 3)}Value`]
                );
    
                totalPrepaidTaxRow[`${String(monthKey).slice(0, 3)}Percent`] = '';
            }
    
            response.push(totalPrepaidTaxRow);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();
    
            const estimatedClaimRow = {    
                index: 81,    
                description: 'Estimated claim for tax refund (tax payable)',  
                type: 'singleMain',    
            };

            estimatedClaimRow[`janValue`] = totalPrepaidTaxRow[`janValue`] - totalTaxExpense;
    
            response.push(estimatedClaimRow);
            checkResponseCompletion(response, res);
            checkIfAllWorkersCompleted();   
        };
    } catch (error) {    
        console.log(error);      
        sendData(res, { type: 'error', message: 'An error occurred while processing your request.' });  
    }    
};

const fetchVolumeSales = async( tahun, domain) => { 
    const calculateVolumeSales = async (tahun, domain) => {
        return await db('dbPortalFA.dbo.volume_pnl')
            .select('bulan')
            .sum('volume_budget as total_volume_budget')
            .select(db.raw(`
                CASE 
                    WHEN bulan = 1 THEN 'January'
                    WHEN bulan = 2 THEN 'February'
                    WHEN bulan = 3 THEN 'March'
                    WHEN bulan = 4 THEN 'April'
                    WHEN bulan = 5 THEN 'May'
                    WHEN bulan = 6 THEN 'June'
                    WHEN bulan = 7 THEN 'July'
                    WHEN bulan = 8 THEN 'August'
                    WHEN bulan = 9 THEN 'September'
                    WHEN bulan = 10 THEN 'October'
                    WHEN bulan = 11 THEN 'November'
                    WHEN bulan = 12 THEN 'December'
                END AS nama_bulan
            `))
            .where('tahun', tahun)
            .where('domain', domain)
            .groupBy('bulan')
            .orderBy('bulan', 'asc');
    };
    
    const volumeSales = await calculateVolumeSales(tahun, domain);
    return volumeSales;
}

const fetchVolumeSalesLastYear = async (tahun, domain) => {     
    const results = await db('transaksi_volume_aktual')
        .sum('qty as total')  
        .sum('tonase as total_tonase')  
        .where('domain', domain)
        .where('ship_date', '>=', `${tahun}-01-01`)  
        .andWhere('ship_date', '<=', `${tahun}-12-31`)
        .first();

    let totalFiscalLastYear = results.total;
    return totalFiscalLastYear;  
}; 

const fetchTaxData = async (component, tahun, domain) => {
    const calculateTax = async (component, tahun, domain) => {      
        try {
            const result = await db('dbPortalFA.dbo.estimasi_tax')  
            .select('value')
            .whereRaw('LOWER(detail) = LOWER(?)', [component])
            .where('tahun', tahun)
            .where('domain', domain)
            .first();
    
            const total = result ? result.value : 0;     
            return total;
        } catch (error) {      
            console.error("Error calculating Value OPEX:", error);      
            throw error;    
        }      
    };     
      
    const taxTotal = [];      
    for (let i = 1; i <= 12; i++) {      
        const grandTotal = await calculateTax(component, tahun, domain);    
        taxTotal.push({ month: i, total: grandTotal });      
    }
      
    return taxTotal; 
}

const fetchBebanData = async(beban, tahun, domain) => {
    const calculateBeban = async (beban, bulan, tahun, domain) => {      
        try {      
            const result = db('dbPortalFA.dbo.qad_gl as qad')  
            .join('dbPortalFA.dbo.pnl_gl as pnl', function() {        
                this.on('qad.gl_code', '=', 'pnl.gl_id')        
                    .andOn('pnl.tahun', '=', tahun)        
                    .andOn('pnl.domain', '=', domain);        
            })      
            .join('dbPortalFA.dbo.opex as op', function() {        
                this.on('pnl.gl_id', '=', 'op.gl_id')      
                    .andOn('op.bulan', '=', bulan)        
                    .andOn('op.tahun', '=', tahun)        
                    .andOn('op.domain', '=', domain);        
            })      
            .whereRaw('LOWER(qad.gl_desc) = LOWER(?)', [beban])       
            .select('op.budget'); 
    
            const budget = result.length > 0 ? result[0].budget : 0;     
            return budget * -1;
        } catch (error) {      
            console.error("Error calculating Value OPEX:", error);      
            throw error;    
        }      
    };          
        
    const bebanTotal = [];      
    for (let i = 1; i <= 12; i++) {      
        const grandTotal = await calculateBeban(beban, i, tahun, domain);    
        bebanTotal.push({ month: i, total: grandTotal });      
    }      
    
    return bebanTotal;  
}

const fetchComponentData= async(jenisProduksiComp, tahun, domain) => { 
    const fetchVolumeAndPriceData = async (jenisProduksiList, bulan, tahun, domain) => {  
        const results = await db('dbPortalFA.dbo.volume_pnl as v')  
            .join('dbPortalFA.dbo.asumsi_price_pnl as a', function() {  
                this.on('v.jenis_produksi_id', '=', 'a.jenis_produksi_id')  
                    .andOn('v.bulan', '=', 'a.bulan')  
                    .andOn('v.tahun', '=', 'a.tahun')  
                    .andOn('v.domain', '=', 'a.domain');  
            })  
            .select('v.volume_budget as volume', 'a.avg_price_budget as price', 'a.diskon_budget as diskon', 'v.jenis_produksi_id')  
            .whereIn('v.jenis_produksi_id', jenisProduksiList.map(jenis => jenis.jenis_produksi_id))  
            .where('v.bulan', bulan)  
            .where('v.tahun', tahun)  
            .andWhere('v.domain', domain);  
      
        return results;
    };  
      
    const calculatePenjualanBruto = async (jenisProduksiList, bulan, tahun, domain) => {  
        const results = await fetchVolumeAndPriceData(jenisProduksiList, bulan, tahun, domain);  
        const tambahanBudget = 453.76;  
      
        const total = results.reduce((acc, row) => {  
            const volumeTotal = row.volume || 0;  
            const priceTotal = row.price || 0;  
      
            const jenisProduksi = jenisProduksiList.find(jenis => jenis.jenis_produksi_id === row.jenis_produksi_id);
            const totalForRow = jenisProduksi && jenisProduksi.jenis_produksi === 'spool pipe'  
                ? (volumeTotal / tambahanBudget) * priceTotal  
                : volumeTotal * priceTotal;  
      
            return acc + totalForRow;  
        }, 0);  
      
        return total;  
    };  
      
    const calculatePotonganPenjualan = async (jenisProduksiList, bulan, tahun, domain) => {  
        const results = await fetchVolumeAndPriceData(jenisProduksiList, bulan, tahun, domain);  
        const tambahanBudget = 453.76;  
      
        const total = results.reduce((acc, row) => {  
            const volumeTotal = row.volume || 0;  
            const priceTotal = row.price || 0;  
            const diskonTotal = row.diskon || 0;  
      
            const jenisProduksi = jenisProduksiList.find(jenis => jenis.jenis_produksi_id === row.jenis_produksi_id);
            const totalForRow = jenisProduksi && jenisProduksi.jenis_produksi === 'spool pipe'  
                ? ((volumeTotal / tambahanBudget) * priceTotal) * (1 - (diskonTotal / 100))  
                : (volumeTotal * priceTotal) * (1 - (diskonTotal / 100));  
      
            return acc + totalForRow;  
        }, 0);  
      
        return total;  
    };  
       
    const componentTotal = [];  
    for (let i = 1; i <= 12; i++) {  
        const bruto = await calculatePenjualanBruto(jenisProduksiComp, i, tahun, domain);
        const potongan = await calculatePotonganPenjualan(jenisProduksiComp, i, tahun, domain);  
    
        const penjualanBersih = bruto - potongan;  
        const grandTotal = bruto + potongan;  
        const percentage = penjualanBersih !== 0 ? (grandTotal / penjualanBersih) : 0;
    
        componentTotal.push({ month: i, total: grandTotal, percent: percentage });  
    }  
    
    return componentTotal;  

}

const fetchFOHData = async(tahun, domain) => {
    const calculateFOH = async (bulan, tahun, domain) => {    
        try {    
            const result = await db('dbPortalFA.dbo.opex')    
                .where('foh', true)  
                .where('bulan', bulan)  
                .where('tahun', tahun)  
                .where('domain', domain)  
                .sum({ totalBudget: 'budget' });  
               
            const totalBudget = result[0]?.totalBudget || 0;
            const valueOPEX = totalBudget * -1;    
        
            return valueOPEX;    
        } catch (error) {    
            console.error("Error calculating Value OPEX:", error);    
            throw error;  
        }    
    };   
    
    const fohTotal = [];    
    for (let i = 1; i <= 12; i++) {    
        const grandTotal = await calculateFOH(i, tahun, domain);  
        fohTotal.push({ month: i, total: grandTotal });    
    }    
    
    return fohTotal;    
}

const fetchBoxData = async(glAccounts, tahun, domain) => {
    const calculateValueOPEX = async (glAcccounts, bulan, tahun, domain) => {    
        try {    
            const result = await db('dbPortalFA.dbo.opex')    
                .whereIn('gl_id', glAcccounts)  
                .where('bulan', bulan)  
                .where('tahun', tahun)  
                .where('domain', domain)  
                .sum({ totalBudget: 'budget' });  
              
            const totalBudget = result[0]?.totalBudget || 0;  
            const valueOPEX = totalBudget * -1;    
        
            return valueOPEX;    
        } catch (error) {    
            console.error("Error calculating Value OPEX:", error);    
            throw error;  
        }    
    };   
        
    const boxTotal = [];    
    for (let i = 1; i <= 12; i++) {    
        const grandTotal = await calculateValueOPEX(glAccounts, i, tahun, domain);  
        boxTotal.push({ month: i, total: grandTotal });    
    }    
    
    return boxTotal;    
}

const fetchTradingData = async(jenisProduksiCogsTrading, tahun, domain) => {
    const fetchVolumeAndPriceData = async (jenisProduksiList, bulan, tahun, domain) => {  
        const results = await db('dbPortalFA.dbo.volume_pnl as v')  
            .join('dbPortalFA.dbo.asumsi_price_pnl as a', function() {  
                this.on('v.jenis_produksi_id', '=', 'a.jenis_produksi_id')  
                    .andOn('v.bulan', '=', 'a.bulan')  
                    .andOn('v.tahun', '=', 'a.tahun')  
                    .andOn('v.domain', '=', 'a.domain');  
            }) 
            .select('v.volume_budget as volume', 'a.hpp_budget as hpp', 'v.jenis_produksi_id')  
            .whereIn('v.jenis_produksi_id', jenisProduksiList.map(jenis => jenis.jenis_produksi_id))  
            .where('v.bulan', bulan)  
            .where('v.tahun', tahun)  
            .andWhere('v.domain', domain);  
        
        return results;  
    };  
      
    const calculateCOGS = async (jenisProduksiList, bulan, tahun, domain) => {  
        const results = await fetchVolumeAndPriceData(jenisProduksiList, bulan, tahun, domain);   
      
        const total = results.reduce((acc, row) => {  
            const volumeTotal = row.volume || 0;  
            const hppTotal = row.hpp || 0;  
      
            const jenisProduksi = jenisProduksiList.find(jenis => jenis.jenis_produksi_id === row.jenis_produksi_id);
            const totalForRow = jenisProduksi.jenis_produksi === 'access fittings'
                ? (-volumeTotal * hppTotal)  : volumeTotal * hppTotal;  
      
            return acc + totalForRow;  
        }, 0);  
      
        return total;  
    };
      
    const tradingTotal = [];  
    for (let i = 1; i <= 12; i++) {   
        const cogsTrading = await calculateCOGS(jenisProduksiCogsTrading, i, tahun, domain);
        tradingTotal.push({ month: i, total: cogsTrading, percent: 0 });  
    }  
    
    return tradingTotal;  
}

const fetchPipaData = async (jenisProduksiPipa, jenisProduksiPipaNonProduksi, tahun, domain) => {
    const fetchVolumeAndPriceData = async (jenisProduksiList, bulan, tahun, domain) => {  
        // Fetch all necessary data in a single query  
        const results = await db('dbPortalFA.dbo.volume_pnl as v')  
            .join('dbPortalFA.dbo.asumsi_price_pnl as a', function() {  
                this.on('v.jenis_produksi_id', '=', 'a.jenis_produksi_id')  
                    .andOn('v.bulan', '=', 'a.bulan')  
                    .andOn('v.tahun', '=', 'a.tahun')  
                    .andOn('v.domain', '=', 'a.domain');  
            })
            .select('v.volume_budget as volume', 'a.avg_price_budget as price', 'a.diskon_budget as diskon', 'v.jenis_produksi_id')  
            .whereIn('v.jenis_produksi_id', jenisProduksiList.map(jenis => jenis.jenis_produksi_id))  
            .where('v.bulan', bulan)  
            .where('v.tahun', tahun)  
            .andWhere('v.domain', domain);  
      
        return results;  
    };  
      
    const calculatePenjualanBruto = async (jenisProduksiList, bulan, tahun, domain) => {  
        const results = await fetchVolumeAndPriceData(jenisProduksiList, bulan, tahun, domain);  
        const tambahanBudget = 453.76;  
      
        
        const total = results.reduce((acc, row) => {  
            const volumeTotal = row.volume || 0;  
            const priceTotal = row.price || 0;  
      
            const jenisProduksi = jenisProduksiList.find(jenis => jenis.jenis_produksi_id === row.jenis_produksi_id);
            const totalForRow = jenisProduksi && jenisProduksi.jenis_produksi === 'spool pipe'  
                ? (volumeTotal / tambahanBudget) * priceTotal  
                : volumeTotal * priceTotal;  
      
            return acc + totalForRow;  
        }, 0);  
      
        return total;  
    };  
      
    const calculatePotonganPenjualan = async (jenisProduksiList, bulan, tahun, domain) => {  
        const results = await fetchVolumeAndPriceData(jenisProduksiList, bulan, tahun, domain);  
        const tambahanBudget = 453.76;  
      
        const total = results.reduce((acc, row) => {  
            const volumeTotal = row.volume || 0;  
            const priceTotal = row.price || 0;  
            const diskonTotal = row.diskon || 0;  
      
            const jenisProduksi = jenisProduksiList.find(jenis => jenis.jenis_produksi_id === row.jenis_produksi_id);
            const totalForRow = jenisProduksi && jenisProduksi.jenis_produksi === 'spool pipe'  
                ? ((volumeTotal / tambahanBudget) * priceTotal) * (1 - (diskonTotal / 100))  
                : (volumeTotal * priceTotal) * (1 - (diskonTotal / 100));  
      
            return acc + totalForRow;  
        }, 0);  
      
        return total;  
    };  
      
    const pipaTotal = [];  
    for (let i = 1; i <= 12; i++) {  
        const brutoPipa = await calculatePenjualanBruto(jenisProduksiPipa, i, tahun, domain);  
        const brutoNonProduksi = await calculatePenjualanBruto(jenisProduksiPipaNonProduksi, i, tahun, domain);  
    
        const potonganPipa = await calculatePotonganPenjualan(jenisProduksiPipa, i, tahun, domain);  
        const potonganNonProduksi = await calculatePotonganPenjualan(jenisProduksiPipaNonProduksi, i, tahun, domain);  
    
        const penjualanBersih = (brutoPipa + brutoNonProduksi) - (potonganPipa + potonganNonProduksi);  
        const grandTotal = brutoPipa + brutoNonProduksi + potonganPipa + potonganNonProduksi;  
        const percentage = penjualanBersih !== 0 ? (grandTotal / penjualanBersih) : 0;
    
        pipaTotal.push({ month: i, total: grandTotal, percent: percentage });  
    }  
    
    return pipaTotal;   
}

const fetchPenjualanBruto = async (jenisProduksi, jenisProduksiProject, jenisProduksiNonProduksi, tahun, domain) => {
    const calculateTotal = async (jenisProduksiList, bulan, tahun, domain) => {  
        // Get all necessary data in a single query  
        const results = await db('dbPortalFA.dbo.volume_pnl as v')  
            .join('dbPortalFA.dbo.asumsi_price_pnl as a', function() {  
                this.on('v.jenis_produksi_id', '=', 'a.jenis_produksi_id')  
                    .andOn('v.bulan', '=', 'a.bulan')  
                    .andOn('v.tahun', '=', 'a.tahun')  
                    .andOn('v.domain', '=', 'a.domain');  
            })  
            .select('v.volume_budget as volume', 'a.avg_price_budget as price', 'v.jenis_produksi_id')  
            .whereIn('v.jenis_produksi_id', jenisProduksiList.map(jenis => jenis.jenis_produksi_id))  
            .where('v.bulan', bulan)  
            .where('v.tahun', tahun)  
            .andWhere('v.domain', domain);  
      
        const tambahanBudget = 453.76;  
      
        // Calculate total based on the retrieved data  
        const total = results.reduce((acc, row) => {  
            const volumeTotal = row.volume || 0;  
            const priceTotal = row.price || 0;  
      
            // Check the jenis_produksi_id to apply the specific calculation  
            const jenisProduksi = jenisProduksiList.find(jenis => jenis.jenis_produksi_id === row.jenis_produksi_id);  
            const totalForRow = jenisProduksi && jenisProduksi.jenis_produksi === 'spool pipe'  
                ? (volumeTotal / tambahanBudget) * priceTotal  
                : volumeTotal * priceTotal;  
      
            return acc + totalForRow;  
        }, 0);  
      
        return total;  
    };  
    
    // Calculate totals for each month  
    const monthlyTotals = [];  
    for (let i = 1; i <= 12; i++) {  
        const retailTotal = await calculateTotal(jenisProduksi, i, tahun, domain);  
        const projectTotal = await calculateTotal(jenisProduksiProject, i, tahun, domain);  
        const nonProduksiTotal = await calculateTotal(jenisProduksiNonProduksi, i, tahun, domain);  
    
        const grandTotal = retailTotal + projectTotal + nonProduksiTotal;  
        monthlyTotals.push({ month: i, total: grandTotal });  
    }  
    
    return monthlyTotals;  
}

const fetchPotonganPenjualan = async (jenisProduksi, jenisProduksiProject, jenisProduksiNonProduksi, tahun, domain) => {
    const calculatePotonganPenjualan = async (jenisProduksiList, bulan, tahun, domain) => {  
        // Get all necessary data in a single query  
        const results = await db('dbPortalFA.dbo.volume_pnl as v')  
            .join('dbPortalFA.dbo.asumsi_price_pnl as a', function() {  
                this.on('v.jenis_produksi_id', '=', 'a.jenis_produksi_id')  
                    .andOn('v.bulan', '=', 'a.bulan')  
                    .andOn('v.tahun', '=', 'a.tahun')  
                    .andOn('v.domain', '=', 'a.domain');  
            })  
            .select('v.volume_budget as volume', 'a.avg_price_budget as price', 'a.diskon_budget as diskon', 'v.jenis_produksi_id')  
            .whereIn('v.jenis_produksi_id', jenisProduksiList.map(jenis => jenis.jenis_produksi_id))  
            .where('v.bulan', bulan)  
            .where('v.tahun', tahun)  
            .andWhere('v.domain', domain);  
      
        const tambahanBudget = 453.76;  
      
        // Calculate total based on the retrieved data  
        const total = results.reduce((acc, row) => {  
            const volumeTotal = row.volume || 0;  
            const priceTotal = row.price || 0;  
            const diskonTotal = row.diskon || 0;  
      
            // Check the jenis_produksi_id to apply the specific calculation  
            const jenisProduksi = jenisProduksiList.find(jenis => jenis.jenis_produksi_id === row.jenis_produksi_id);  
            const calculatedTotal = jenisProduksi && jenisProduksi.jenis_produksi === 'spool pipe'  
                ? (((volumeTotal / tambahanBudget) * priceTotal) * (-diskonTotal) / 100)  
                : ((volumeTotal * priceTotal) * (-diskonTotal) / 100);  
      
            return acc + calculatedTotal;  
        }, 0);  
      
        return total;  
    };  
      
    // Calculate totals for each month  
    const potonganPenjualanTotal = [];  
    for (let i = 1; i <= 12; i++) {  
        const retailTotal = await calculatePotonganPenjualan(jenisProduksi, i, tahun, domain);  
        const projectTotal = await calculatePotonganPenjualan(jenisProduksiProject, i, tahun, domain);  
        const nonProduksiTotal = await calculatePotonganPenjualan(jenisProduksiNonProduksi, i, tahun, domain);  
    
        const grandTotal = retailTotal + projectTotal + nonProduksiTotal;  
        potonganPenjualanTotal.push({ month: i, total: grandTotal });  
    }  
    
    return potonganPenjualanTotal;  
}

const fetchHPPData = async(jenisProduksiCogsProject, jenisProduksiCogsTrading, tahun, domain) => {
    const fetchVolumeAndPriceData = async (jenisProduksiList, bulan, tahun, domain) => {  
        const results = await db('dbPortalFA.dbo.volume_pnl as v')  
            .join('dbPortalFA.dbo.asumsi_price_pnl as a', function() {  
                this.on('v.jenis_produksi_id', '=', 'a.jenis_produksi_id')  
                    .andOn('v.bulan', '=', 'a.bulan')  
                    .andOn('v.tahun', '=', 'a.tahun')  
                    .andOn('v.domain', '=', 'a.domain');  
            }) 
            .select('v.volume_budget as volume', 'a.hpp_budget as hpp', 'v.jenis_produksi_id')  
            .whereIn('v.jenis_produksi_id', jenisProduksiList.map(jenis => jenis.jenis_produksi_id))  
            .where('v.bulan', bulan)  
            .where('v.tahun', tahun)  
            .andWhere('v.domain', domain);  
        
        return results;  
    };  
      
    const calculateCOGS = async (jenisProduksiList, bulan, tahun, domain) => {  
        const results = await fetchVolumeAndPriceData(jenisProduksiList, bulan, tahun, domain);   
      
        const total = results.reduce((acc, row) => {  
            const volumeTotal = row.volume || 0;  
            const hppTotal = row.hpp || 0;  
      
            const jenisProduksi = jenisProduksiList.find(jenis => jenis.jenis_produksi_id === row.jenis_produksi_id);
            const totalForRow = jenisProduksi.jenis_produksi === 'jacking pipe' || jenisProduksi.jenis_produksi === 'access fittings'
                ? (-volumeTotal * hppTotal)  : volumeTotal * hppTotal;  
      
            return acc + totalForRow;  
        }, 0);  
      
        return total;  
    };
    
    const calculateBahanPembantu = async (bulan, tahun, domain) => {
        const jenis = [   
            'pvc sni lok & safe',  
            'pvc sni lite',  
            'pipa apollo/exoplast',  
            'fitting tigris',  
            'fitting kelen',  
            'fitting im non mi',  
            'fitting im metal insert',  
            'ruglue'   
        ]
        
        const jenisProduksiList = await db('dbPortalFA.dbo.jenis_produksi')  
        .select('jenis_produksi_id')  
        .where('domain', domain)  
        .whereIn(db.raw('LOWER(jenis_produksi)'), jenis);  
    
        const volume = await db('dbPortalFA.dbo.volume_produksi_pnl')  
          .whereIn('jenis_produksi_id', jenisProduksiList.map(jenis => jenis.jenis_produksi_id))
          .andWhere('tahun', tahun)  
          .andWhere('bulan', bulan)
          .sum('volume_budget as total_volume_budget')  
          .first();  
      
        const totalBahanPembantu = await db('dbPortalFA.dbo.material_pendukung')
          .whereIn('jenis_produksi_id', jenisProduksiList.map(jenis => jenis.jenis_produksi_id))
          .where('tahun', tahun)  
          .sum('bahan_pembantu as total_bahan_pembantu')  
          .first();  
      
        const totalBahanPackaging = await db('dbPortalFA.dbo.material_pendukung')
          .whereIn('jenis_produksi_id', jenisProduksiList.map(jenis => jenis.jenis_produksi_id)) 
          .where('tahun', tahun)  
          .sum('bahan_packaging as total_bahan_packaging')  
          .first();  
      
        const totalBahanPenolong = await db('dbPortalFA.dbo.material_pendukung')
          .whereIn('jenis_produksi_id', jenisProduksiList.map(jenis => jenis.jenis_produksi_id))  
          .where('tahun', tahun)  
          .sum('bahan_penolong as total_bahan_penolong')  
          .first();  
      
        const totalJasaMaklon = await db('dbPortalFA.dbo.material_pendukung')
          .whereIn('jenis_produksi_id', jenisProduksiList.map(jenis => jenis.jenis_produksi_id))  
          .where('tahun', tahun)  
          .sum('jasa_maklon as total_jasa_maklon')  
          .first();  
      
        const total = (volume.total_volume_budget || 0) +  
          (totalBahanPembantu.total_bahan_pembantu || 0) +  
          (totalBahanPackaging.total_bahan_packaging || 0) +  
          (totalBahanPenolong.total_bahan_penolong || 0) +  
          (totalJasaMaklon.total_jasa_maklon || 0);
          
        return total;
    }
    
    const calculateRawMaterial = async (bulan, tahun, domain) => {
        const asumsiPriceMaterial = await db('asumsi_price_material as apm')  
        .join('kurs_pnl as kp', 'apm.kurs_id', 'kp.kurs_pnl_id')  
        .select(db.raw('SUM(apm.value_item * kp.budget) AS total'))  
        .where('apm.domain', domain)
        .where('apm.tahun', tahun)  
        .andWhere('kp.bulan', bulan);
    
        const asumsiTotal = asumsiPriceMaterial[0]?.total || 0;  
    
        const produksiData = await db('volume_produksi_pnl as vpp')  
        .join('reject as r', 'vpp.jenis_produksi_id', 'r.jenis_produksi_id')  
        .select(  
            db.raw('SUM(vpp.volume_budget) AS volume_budget'),  
            db.raw('SUM(vpp.volume_budget * r.value_reject) AS total'),  
            db.raw(`  
                COALESCE(  
                    (SELECT SUM(rp.qty_per)   
                    FROM resep_pnl rp   
                    WHERE rp.bom_code = vpp.resep_pnl_id),   
                    0  
                ) AS bom_code  
            `)  
        )
        .where('vpp.domain', domain)  
        .where('vpp.tahun', tahun)  
        .andWhere('vpp.bulan', bulan)  
        .andWhere('r.tahun', tahun)  
        .groupBy('vpp.resep_pnl_id');  
    
        let produksiTotal = 0;
        for (const row of produksiData) {
            produksiTotal += (row.total + row.volume_budget) * row.bom_code;
        }
    
        const rawMaterial = asumsiTotal * produksiTotal;
        return rawMaterial;
    }
    
    const calculateBox = async (bulan, tahun, domain) => {    
        const result = await db('dbPortalFA.dbo.opex')    
            .whereIn('gl_id', [6180001, 6180002, 6180099])  
            .where('bulan', bulan)  
            .where('tahun', tahun)  
            .where('domain', domain)  
            .sum({ totalBudget: 'budget' });  
            
        const totalBudget = result[0]?.totalBudget || 0; 
        return totalBudget;
    };
    
    const calculateFOH = async (bulan, tahun, domain) => {     
        const result = await db('dbPortalFA.dbo.opex')    
            .where('foh', true)  
            .where('bulan', bulan)  
            .where('tahun', tahun)  
            .where('domain', domain)  
            .sum({ totalBudget: 'budget' });  
            
        const totalBudget = result[0]?.totalBudget || 0;  
        return totalBudget;
    }; 
    
    const calculateVolumeBudget = async (bulan, tahun, domain) => {
        const sumVolumeBudget = await db("volume_produksi_pnl")
        .where({ tahun, bulan, domain })
        .sum("volume_budget as total")
        .first();
    
        const totalSumVolumeBudget = parseFloat(sumVolumeBudget?.total || 0);
        return totalSumVolumeBudget;
    }
    
    const calculateSumJenisProduksi = async (bulan, tahun, domain) => {
      const sumJenisProduksi = await db("volume_pnl as vp")
        .join(
          "jenis_produksi as jp",
          "vp.jenis_produksi_id",
          "jp.jenis_produksi_id"
        )
        .where("vp.tahun", tahun)
        .where("vp.bulan", bulan)
        .where("vp.domain", domain)
        .whereIn("jp.jenis_produksi", [
          "PVC RETAIL",
          "PVC JIS",
          "FITTING IM",
          "RUGLUE",
          "PVC SNI",
          "PIPA Exoplast",
          "PIPA PE",
          "Pipa TIGRIS",
          "PIPA KELEN GREY",
          "FITTING TIGRIS",
          "FITTING KELEN GREY",
        ])
        .sum("vp.volume_budget as total")
        .first();
    
        const totalSumJenisProduksi = parseFloat(sumJenisProduksi?.total || 0);
        return totalSumJenisProduksi
    }
    
    const getBeginingInventory = async (bulan, tahun, domain) => {
        const result = await db('dbPortalFA.dbo.begin_cogs_pnl')      
            .where('bulan', bulan)  
            .where('tahun', tahun)  
            .where('domain', domain)  
            .sum({ total: 'value_budget' });
    
        const total = parseFloat(result.total || 0)
        return total;
    }

    // Calculate totals for each month  
    const cogsTotal = [];  
    for (let i = 1; i <= 12; i++) {  
        const cogsProject = await calculateCOGS(jenisProduksiCogsProject, i, tahun, domain);  
        const cogsTrading = await calculateCOGS(jenisProduksiCogsTrading, i, tahun, domain);

        // Count Available Sales
        const rawmaterial = await calculateRawMaterial(i, tahun, domain);
        const bahanPembantu = await calculateBahanPembantu(i, tahun, domain);
        const foh = await calculateFOH(i, tahun, domain);
        const box = await calculateBox(i, tahun, domain);
        const beginingInventory = await getBeginingInventory(i, tahun, domain);
        const availableSales = beginingInventory + (rawmaterial + bahanPembantu + foh + box);
        
        // Count Cogs
        const totalSumJenisProduksi = await calculateSumJenisProduksi(i, tahun, domain);
        const totalSumVolumeBudget = await calculateVolumeBudget(i, tahun, domain);
        const hasilCOGS = (availableSales / totalSumVolumeBudget) * totalSumJenisProduksi;
        
        // Count Cogm
        const cogm = availableSales - hasilCOGS;

        const grandTotal = (cogsProject + cogsTrading + cogm) * -1;
        cogsTotal.push({ month: i, total: grandTotal, percent: 0 });  
    }  
    
    return cogsTotal;
}

const calculateLastYearFiscal = async (component, tahun, domain) => {
    const aktual = await db('dbPortalFA.dbo.kode_pnl as kp')    
    .select(    
        'kp.kode_pnl_id',    
        db.raw('COALESCE(SUM(ta.dec), 0) as total')    
    )    
    .leftJoin('dbPortalFA.dbo.pnl_gl as pnl', 'kp.kode_pnl_id', 'pnl.kode_pnl_id')
    .leftJoin('dbPortalFA.dbo.transaksi_aktual as ta', 'pnl.gl_id', 'ta.gl_code') 
    .whereRaw('LOWER(kp.detail) = LOWER(?)', [component])
    .where('kp.tipe', 'Aktual')    
    .where('ta.domain', domain)
    .where('ta.tahun', tahun)
    .groupBy('kp.kode_pnl_id');

    const total = aktual.length > 0 ? aktual[0].total : 0;
    return total;
}