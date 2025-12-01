import fs from "fs";
import axios  from "axios";
import { parseStringPromise as xmlToJs } from "xml2js";
import * as dotenv from 'dotenv' 
import { getWSA } from "../helpers/utils.js";
dotenv.config()

export const inbound_barcode = async (
  request,
  status,
  wo,
  level_define,
  shift = null,
  mesin = null,
  type = null,
  jenis = null
) => {
  let address_issue;
  let address_receipt;
  let wo_id;
  let remark;
  let remark1;
  let qtyrct;
  let div = request["receipt"].tr_domain == "300" ? "PRODRB" : "PRODAC";

  if (type == "bs") {
    address_issue = "";
    address_receipt = "";
    wo_id = "";
    remark = "BS";
  } else {
    address_issue = !request["issue"].tr_addr
      ? request["issue"].level == 3
        ? request["issue"].tr_addr
        : wo.wo_vend
      : request["issue"].tr_addr;
    address_receipt = !request["receipt"].tr_addr
      ? request["issue"].level == 3
        ? request["issue"].tr_addr
        : wo.wo_vend
      : request["receipt"].tr_addr;
    wo_id = wo.id_wo;
    remark = request["receipt"].remark;
  }

  let cond =
    status == "bs" ? "rejectbs" : status == "blokir" ? "rejectbl" : status;

  if (jenis == "bspuing") {
    qtyrct = request["receipt"].tr_kg;
  } else {
    qtyrct = request["receipt"].tr_qty_loc;
  }

  if (level_define.op == "rework") {
    if (wo == "bs_sortir_ghp") {
      remark1 = "";
    } else if (wo == "bs_sortir_prod") {
      remark1 = request["receipt"].tr_nbr;
    } else {
      remark1 = remark;
    }
  } else {
    remark1 = jenis == "bspuing" ? "BS" : remark;
  }

  if (address_issue == "7:00") {
    address_issue = "07:00";
  }

  if (address_receipt == "7:00") {
    address_issue = "07:00";
  }

  if (level_define.op == "fingood_tatakan") {
    level_define.op = "fingood";
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
  <soapenv:Envelope xmlns="urn:schemas-qad-com:xml-services"
    xmlns:qcom="urn:schemas-qad-com:xml-services:common"
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <soapenv:Header>
      <wsa:Action/>
      <wsa:To>urn:services-qad-com:' . $rcv . '</wsa:To>
      <wsa:MessageID>urn:services-qad-com::' . $rcv . '</wsa:MessageID>
      <wsa:ReferenceParameters>
        <qcom:suppressResponseDetail>true</qcom:suppressResponseDetail>
      </wsa:ReferenceParameters>
      <wsa:ReplyTo>
        <wsa:Address>urn:services-qad-com:</wsa:Address>
      </wsa:ReplyTo>
    </soapenv:Header>
    <soapenv:Body>
      <BarcodeNewQdocs>
        <qcom:dsSessionContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>domain</qcom:propertyName>
            <qcom:propertyValue>${request["receipt"].tr_domain}</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>scopeTransaction</qcom:propertyName>
            <qcom:propertyValue>false</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>version</qcom:propertyName>
            <qcom:propertyValue>eB_1</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>mnemonicsRaw</qcom:propertyName>
            <qcom:propertyValue>false</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>username</qcom:propertyName>
            <qcom:propertyValue>${process.env.INBOUND_USER}</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>password</qcom:propertyName>
            <qcom:propertyValue>${process.env.INBOUND_PASS}</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>action</qcom:propertyName>
            <qcom:propertyValue/>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>entity</qcom:propertyName>
            <qcom:propertyValue/>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>email</qcom:propertyName>
            <qcom:propertyValue/>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>emailLevel</qcom:propertyName>
            <qcom:propertyValue/>
          </qcom:ttContext>
        </qcom:dsSessionContext>
        <dsBarcodeNewQdoc>
          <BarcodeNewQdoc>
        <operation>A</operation>
        <inpWo>${request["receipt"].tr_nbr}</inpWo>
        <idWo>${wo_id}</idWo>
        <cond>${cond}</cond>
        <site>${request["receipt"].tr_site}</site>
        <addrIss>${address_issue}</addrIss>
        <addrRct>${address_receipt}</addrRct>
        <partIss>${request["issue"].tr_part}</partIss>
        <partRct>${request["receipt"].tr_part}</partRct>
        <inpDoc>${request["receipt"].tr_doc_id}</inpDoc>
        <op>${level_define.op}</op>
        <inpLocIss>${request["issue"].tr_loc}</inpLocIss>
        <inpLocRct>${request["receipt"].tr_loc}</inpLocRct>
        <effdate>${request["receipt"].tr_effdate}</effdate>
        <shift>${shift}</shift>
        <emp>${div}</emp>
        <barcodeiss>${request["issue"].lv_num}</barcodeiss>
        <barcoderct>${request["receipt"].lv_num}</barcoderct>
        <inpStokIss>${request["receipt"].tr_qty_loc}</inpStokIss>
        <inpStokRct>${qtyrct}</inpStokRct>
        <soJobIss>${request["issue"].tr_so_job}</soJobIss>
        <soJobRct>${request["receipt"].tr_so_job}</soJobRct>
        <workcenter>${mesin}</workcenter>
        <remark>${remark1}</remark>
          </BarcodeNewQdoc>
        </dsBarcodeNewQdoc>
      </BarcodeNewQdocs>
    </soapenv:Body>
  </soapenv:Envelope>`;

  let filename = `Barcode-${request["receipt"].lv_num}.req`;

  fs.writeFileSync(filename, xml);
};

export const inbound_supp_inv = async (body, type) => {
  const schemaName = 'bcinvoice';
	const version = 'ERP3_1';
  const receiverName = 'WNRLIVE';
  let inv_tax = '';

  let domain  = '120';
  let entity = '1201';

  if (type === 'perjalananDinas') {
    body.daybook = 'APDP';
    body.dayboookSetCode = 'AP-DBC';
    body.currency = 'IDR';
    body.orginalCreditTC = body.on_duty_value_ap;
  } else {
    body.daybook = 'APDP';
    body.dayboookSetCode = 'AP-DBC';
    body.orginalCreditTC = body.tc_amount;
    
    // if (body.is_taxable) {
    //   inv_tax = `<tCInvoiceVat>
    //       <CInvoiceVatVatBaseDebitLC>0.0000</CInvoiceVatVatBaseDebitLC>
    //       <CInvoiceVatVatBaseCreditLC>0.0000</CInvoiceVatVatBaseCreditLC>
    //       <CInvoiceVatVatBaseDebitTC>0.0000</CInvoiceVatVatBaseDebitTC>
    //       <CInvoiceVatVatBaseCreditTC>0.0000</CInvoiceVatVatBaseCreditTC>
    //       <CInvoiceVatVatBaseDebitCC>0.0000</CInvoiceVatVatBaseDebitCC>
    //       <CInvoiceVatVatBaseCreditCC>0.0000</CInvoiceVatVatBaseCreditCC>
    //       <CInvoiceVatVatDebitLC>0.0000</CInvoiceVatVatDebitLC>
    //       <CInvoiceVatVatCreditLC>0.0000</CInvoiceVatVatCreditLC>
    //       <CInvoiceVatVatDebitTC>0.0000</CInvoiceVatVatDebitTC>
    //       <CInvoiceVatVatCreditTC>0.0000</CInvoiceVatVatCreditTC>
    //       <CInvoiceVatVatDebitCC>0.0000</CInvoiceVatVatDebitCC>
    //       <CInvoiceVatVatCreditCC>0.0000</CInvoiceVatVatCreditCC>
    //       <CInvoiceVatIsTaxable>false</CInvoiceVatIsTaxable>
    //       <CInvoiceVatNonRecTaxAmtTC>0.0000</CInvoiceVatNonRecTaxAmtTC>
    //       <CInvoiceVatIsUpdAllow>true</CInvoiceVatIsUpdAllow>
    //       <CInvoiceVatIsAbsRet>false</CInvoiceVatIsAbsRet>
    //       <CInvoiceVatIsAccrRcpUs>false</CInvoiceVatIsAccrRcpUs>
    //       <CInvoiceVatTaxTrType>22</CInvoiceVatTaxTrType>
    //       <CInvoiceVatIsRevCharge>false</CInvoiceVatIsRevCharge>
    //       <CInvoiceVatUILinkedRowID>0</CInvoiceVatUILinkedRowID>
    //       <CInvoiceVatSequence>1</CInvoiceVatSequence>
    //       <CInvoiceVatNTBaseDebitTC>0.0000</CInvoiceVatNTBaseDebitTC>
    //       <CInvoiceVatNTBaseCreditTC>0.0000</CInvoiceVatNTBaseCreditTC>
    //       <CInvoiceVatIsSuspDel>false</CInvoiceVatIsSuspDel>
    //       <CInvoiceVatSuspDelTaxAmtTC>0.0000</CInvoiceVatSuspDelTaxAmtTC>
    //       <TxuTaxUsage/>
    //       <TxenvTaxEnv>IDN</TxenvTaxEnv>
    //       <TxclTaxCls/>
    //       <TxtyTaxType>NON-TAX</TxtyTaxType>
    //       <tdCInvoiceVatVatBaseDebitVC>0.0000</tdCInvoiceVatVatBaseDebitVC>
    //       <tdCInvoiceVatVatBaseCreditVC>0.0000</tdCInvoiceVatVatBaseCreditVC>
    //       <tdCInvoiceVatVatDebitVC>0.0000</tdCInvoiceVatVatDebitVC>
    //       <tdCInvoiceVatVatCreditVC>0.0000</tdCInvoiceVatVatCreditVC>
    //       <tlIsRecalculateTax>false</tlIsRecalculateTax>
    //       <tcDomainCode>120</tcDomainCode>
    //       <tcVatInOut>Input</tcVatInOut>
    //       <tcVatCode>00000000</tcVatCode>
    //       <tcNormalTaxGLCode>1470010</tcNormalTaxGLCode>
    //       <tcNormalTaxDivisionCode/>
    //       <tcAbsRetTaxGLCode/>
    //       <tcAbsRetTaxDivisionCode/>
    //       <tcSuspDelTaxGLCode/>
    //       <tcSuspDelTaxDivisionCode/>
    //       <tlTx2InvDisc>false</tlTx2InvDisc>
    //       <tdCInvoiceVatExchangeRateCC>0.0000000000</tdCInvoiceVatExchangeRateCC>
    //     </tCInvoiceVat>`;
    // }
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns="urn:schemas-qad-com:xml-services"
    xmlns:qcom="urn:schemas-qad-com:xml-services:common"
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsa="http://www.w3.org/2005/08/addressing">
      <soapenv:Header>
        <wsa:Action/>
        <wsa:To>urn:services-qad-com:${receiverName}</wsa:To>
        <wsa:MessageID>urn:services-qad-com::${receiverName}</wsa:MessageID>
        <wsa:ReferenceParameters>
          <qcom:suppressResponseDetail>false</qcom:suppressResponseDetail>
        </wsa:ReferenceParameters>
        <wsa:ReplyTo>
          <wsa:Address>urn:services-qad-com:</wsa:Address>
        </wsa:ReplyTo>
      </soapenv:Header>
      <soapenv:Body>
        <${schemaName}>
          <qcom:dsSessionContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>domain</qcom:propertyName>
              <qcom:propertyValue>${domain}</qcom:propertyValue>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>scopeTransaction</qcom:propertyName>
              <qcom:propertyValue>false</qcom:propertyValue>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>version</qcom:propertyName>
              <qcom:propertyValue>${version}</qcom:propertyValue>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>mnemonicsRaw</qcom:propertyName>
              <qcom:propertyValue>false</qcom:propertyValue>
            </qcom:ttContext>
            
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>username</qcom:propertyName>
              <qcom:propertyValue>${process.env.INBOUND_USER}</qcom:propertyValue>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>password</qcom:propertyName>
              <qcom:propertyValue>${process.env.INBOUND_PASS}</qcom:propertyValue>
            </qcom:ttContext>
            
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>action</qcom:propertyName>
              <qcom:propertyValue>Save</qcom:propertyValue>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>entity</qcom:propertyName>
              <qcom:propertyValue>${entity}</qcom:propertyValue>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>email</qcom:propertyName>
              <qcom:propertyValue/>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>emailLevel</qcom:propertyName>
              <qcom:propertyValue/>
            </qcom:ttContext>
          </qcom:dsSessionContext>
          <BCInvoice>
            <tContextInfo>
              <tcCompanyCode>${entity}</tcCompanyCode>
              <tcCBFVersion>9.2</tcCBFVersion>
              <tcActivityCode>Create</tcActivityCode>
              <tlPartialUpdate>false</tlPartialUpdate>
              <tcPartialUpdateExceptionList/>
            </tContextInfo>
            <tCInvoice>
              <CInvoicePostingDate>${body.created_date}</CInvoicePostingDate>
              <CInvoiceType>Invoice</CInvoiceType>
              <CInvoiceDate>${body.created_date}</CInvoiceDate>
              <CInvoiceReference>${body.allocation_key}</CInvoiceReference>
              <CInvoiceDescription>${body.description}</CInvoiceDescription>
              <CInvoiceOriginalCreditTC>${body.on_duty_value_ap}</CInvoiceOriginalCreditTC>
              <CInvoiceAllocationStatus>${body.allocation_status || ''}</CInvoiceAllocationStatus>
              <CInvoicePostingPeriod>${body.created_date_month}</CInvoicePostingPeriod>
              <CInvoicePostingYear>${body.created_date_year}</CInvoicePostingYear>
              <CInvoicePostingYearPeriod>${body.created_date_year_month}</CInvoicePostingYearPeriod>
              <CInvoiceIsTaxable>false</CInvoiceIsTaxable>
              <CInvoiceDayBookSetCode>${body.dayboookSetCode}</CInvoiceDayBookSetCode>
              <CInvoiceCreationDate>${body.created_date}</CInvoiceCreationDate>
              <tcCreditorCode>${body.suppbank_nbr}</tcCreditorCode>
              <CInvoicePoDomain>${domain}</CInvoicePoDomain>
              <tcBusinessRelationCode>${body.suppbank_nbr}</tcBusinessRelationCode>
              <tcDivisionCode/>
              <tcJournalCode>${body.daybook}</tcJournalCode>
              <tcCurrencyCode>${body.currency}</tcCurrencyCode>          
              <tcReasonAllocationStatus>${body.allocation_status || ''}</tcReasonAllocationStatus>
              <tcReasonCode>${body.inv_status}</tcReasonCode>
              <CInvoiceDueDate>${body.due_date_inv}</CInvoiceDueDate>
              <tcCostCentreCode/>
              <CInvoiceCommentNote>${body.comment}</CInvoiceCommentNote>
              <CustomLong1></CustomLong1>
              <tc_Rowid>1</tc_Rowid>
              <tc_ParentRowid/>
            
              <tCInvoiceBank>
                <tcOwnBankNumber>${body.own_bank_number}</tcOwnBankNumber>
                <tcPayFormatTypeCode>AP_Transfer</tcPayFormatTypeCode>
                <tcPayFormatTypePayInstrument>Check</tcPayFormatTypePayInstrument>
                <tlValidatePayment>true</tlValidatePayment>
                <tcBankNumber>${body.suppbank_nbr}</tcBankNumber>
                <tcBankNumberExtension/>
                <tcBankNumberFormatted>${body.suppbank_nbr}</tcBankNumberFormatted>
                <tcBankNumberSwiftCode/>
                <tcBankNumberValidation>XX</tcBankNumberValidation>
                <tcBusinessRelationCode/>
                <tcOwnGLCode>${body.bank_gl_account}</tcOwnGLCode>
                <tcOwnBankCurr>${body.currency}</tcOwnBankCurr>
                <tcSupplierCurrency/>
                <tc_Rowid>1</tc_Rowid>
                <tc_ParentRowid>1</tc_ParentRowid>
              </tCInvoiceBank>
        
              ${inv_tax}

            </tCInvoice>
          </BCInvoice>
        </${schemaName}>
      </soapenv:Body>
    </soapenv:Envelope>`;

  const response = await axios.post(process.env.URL_INBOUND, xml, {
    headers: {
      "Content-Type": "application/xml",
      SOAPAction: "",
    },
  });

  const xmljs = await xmlToJs(response.data);
  const bodyXml = xmljs['soapenv:Envelope']['soapenv:Body'][0];
  const responseXml = bodyXml['ns1:bcinvoiceResponse'][0];
  const status = responseXml['ns1:result'][0];

  if (status === "success" || status === "warning") {
    return {
      status: "ok"
    };
  } else {
    const exceptions = responseXml['ns3:dsExceptions'][0];
    const errorMessages = exceptions['ns3:temp_err_msg'].map(err => err['ns3:tt_msg_desc'][0]);
    return {
      status: "error",
      message: errorMessages,
    };
  }
};

export const inbound_pettycash_perjalanan_dinas = async (body) => {
  const schemaName = 'bcashbox';
	const version = 'ERP3_1';
  const receiverName = 'WNRLIVE';

  let domain  = '120';
  let entity = '1201';

  body.daybook = 'CB03';
  if (body.allocation_status === 'Unallocated') {
    body.allocation_status = 'UNALLOC';
  }

  // get last account balance
  const argsWsa = {
    parDomain: domain,
    parAccount: body.gl,
  };
  const callWsa = await getWSA(process.env.WSA, "getDBCAccountBalance", argsWsa);
  if (!callWsa || !callWsa.tt_accbal) {
    return {
      status: "error",
      message: 'Gagal melakukan penyimpanan data dan mengirim ke qad, Get Wsa Account Balance dengan gl tersebut tidak ditemukan',
    };
  }
  const resWsaAccountBalance = callWsa.tt_accbal ? callWsa.tt_accbal.tt_accbalRow[0] : [];
  if (!resWsaAccountBalance) {
    return {
      status: "error",
      message: 'Gagal melakukan penyimpanan data dan mengirim ke qad, Get Wsa Account Balance dengan gl tersebut tidak ditemukan',
    };
  }
  // end get last account balance

  body.closeBalance = resWsaAccountBalance.ttclosebal - body.on_duty_value_ap;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
  <soapenv:Envelope xmlns="urn:schemas-qad-com:xml-services"
  xmlns:qcom="urn:schemas-qad-com:xml-services:common"
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <soapenv:Header>
      <wsa:Action/>
      <wsa:To>urn:services-qad-com:${receiverName}</wsa:To>
      <wsa:MessageID>urn:services-qad-com::${receiverName}</wsa:MessageID>
      <wsa:ReferenceParameters>
        <qcom:suppressResponseDetail>true</qcom:suppressResponseDetail>
      </wsa:ReferenceParameters>
      <wsa:ReplyTo>
        <wsa:Address>urn:services-qad-com:</wsa:Address>
      </wsa:ReplyTo>
    </soapenv:Header>
    <soapenv:Body>
      <${schemaName}>
        <qcom:dsSessionContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>domain</qcom:propertyName>
            <qcom:propertyValue>${domain}</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>scopeTransaction</qcom:propertyName>
            <qcom:propertyValue>false</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>version</qcom:propertyName>
            <qcom:propertyValue>${version}</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>mnemonicsRaw</qcom:propertyName>
            <qcom:propertyValue>false</qcom:propertyValue>
          </qcom:ttContext>
          
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>username</qcom:propertyName>
            <qcom:propertyValue>${process.env.INBOUND_USER}</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>password</qcom:propertyName>
            <qcom:propertyValue>${process.env.INBOUND_PASS}</qcom:propertyValue>
          </qcom:ttContext>
          
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>action</qcom:propertyName>
            <qcom:propertyValue>Save</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>entity</qcom:propertyName>
            <qcom:propertyValue>${entity}</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>email</qcom:propertyName>
            <qcom:propertyValue/>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>emailLevel</qcom:propertyName>
            <qcom:propertyValue/>
          </qcom:ttContext>
        </qcom:dsSessionContext>
        <BCashBox>
          <tContextInfo>
            <tcCompanyCode>${entity}</tcCompanyCode>
            <tcInvolvedCompanyCodes>${entity}</tcInvolvedCompanyCodes>
            <tcCBFVersion>9.2</tcCBFVersion>
            <tcActivityCode>Create</tcActivityCode>
            <tlPartialUpdate>false</tlPartialUpdate>
            <tcPartialUpdateExceptionList/>
          </tContextInfo>
          <tBankState>
            <tcGLCode>${body.gl}</tcGLCode>
            <BankStateYear>${body.created_date_year}</BankStateYear>
            <BankStateStatus>${body.allocation_status}</BankStateStatus>
            <BankStatePostingDate>${body.created_date}</BankStatePostingDate>
            <tiPeriodYear>${body.created_date_year}</tiPeriodYear>
            <tiPeriodPeriod>${body.created_date_month}</tiPeriodPeriod>
            <tcGLJournalCode>${body.daybook}</tcGLJournalCode>	
            <BankStateTransactionType>CASH</BankStateTransactionType>
            <BankStateMovement>-${body.on_duty_value_ap}</BankStateMovement>
            <BankStateClosingBalance>${body.closeBalance}</BankStateClosingBalance>
            <tBankStateLine>
              <BankStateLineNumber>1</BankStateLineNumber>
              <BankStateLineValueDate>${body.created_date}</BankStateLineValueDate>
              <BankStateLinePostingDate>${body.created_date}</BankStateLinePostingDate>
              <BankStateLineDescription>${body.description}</BankStateLineDescription>
              <BankStateLineAmountTC>-${body.on_duty_value_ap}</BankStateLineAmountTC>
              <BankStateLineInOut>-</BankStateLineInOut>
              <BankStateLineStatus>${body.allocation_status}</BankStateLineStatus>
              <tiPostingPeriodYear>${body.created_date_year}</tiPostingPeriodYear>
              <tcPostingJournalCode>${body.daybook}</tcPostingJournalCode>
              <tiPeriodYear>${body.created_date_year}</tiPeriodYear>
              <tiPeriodPeriod>${body.created_date_month}</tiPeriodPeriod>
              <tdBankStateLineAmountLC>-${body.on_duty_value_ap}</tdBankStateLineAmountLC>
            </tBankStateLine>
          </tBankState>
        </BCashBox>
      </${schemaName}>
    </soapenv:Body>
  </soapenv:Envelope>`;

  const response = await axios.post(process.env.URL_INBOUND, xml, {
    headers: {
      "Content-Type": "application/xml",
      SOAPAction: "",
    },
  });

  const xmljs = await xmlToJs(response.data);
  const bodyXml = xmljs['soapenv:Envelope']['soapenv:Body'][0];
  const responseXml = bodyXml['ns1:bcashboxResponse'][0];
  const status = responseXml['ns1:result'][0];

  if (status === "success" || status === "warning") {
    return {
      status: "ok"
    };
  } else {
    const exceptions = responseXml['ns3:dsExceptions'][0];
    const errorMessages = exceptions['ns3:temp_err_msg'].map(err => err['ns3:tt_msg_desc'][0]);
    return {
      status: "error",
      message: errorMessages,
    };
  }
};


export const inbound_supp_inv_non_perjalanan_dinas = async (body) => {
  const schemaName = 'bcinvoice';
  const version = 'ERP3_1';
  const receiverName = 'WNRLIVE';

  let domain = 120;
  let entity = '1201';

  body.daybook = 'APDP';
  body.dayboookSetCode = 'AP-DBC';
  // body.currency = 'IDR';
  let inv_tax_xml = '';

  if (body.is_taxable) {
    const taxXmlList = await Promise.all(
    body.items.map(async (item, index) => {
      if (!item.tax_based) return '';

      // const args = {
      //   parDomain: 120,
      //   parTaxCode: "",
      // };

      // // Pastikan WSA URL tersedia
      // if (!process.env.WSA) {
      //   throw new Error("Missing WSA environment variable.");
      // }

      // // Ambil data pajak dari WSA
      // const callWsa = await getWSA(process.env.WSA, "getDBCTaxMstr", args);
      // const getTax = callWsa?.tt_tx2_mstr?.tt_tx2_mstrRow || null;

      // // Cari jenis pajak yang cocok
      // let type = getTax ? getTax.find((v) => v.tx2_tax_usage === item.jenis_pajak) : null;

      // return `
      //   <tCInvoiceVat>
      //     <CInvoiceVatVatBaseDebitLC>${item.tax_based}</CInvoiceVatVatBaseDebitLC>
      //     <CInvoiceVatVatBaseCreditLC>0.0000</CInvoiceVatVatBaseCreditLC>
      //     <CInvoiceVatVatBaseDebitTC>${item.tax_based}</CInvoiceVatVatBaseDebitTC>
      //     <CInvoiceVatVatBaseCreditTC>0.0000</CInvoiceVatVatBaseCreditTC>
      //     <CInvoiceVatVatBaseDebitCC>${item.tax_based}</CInvoiceVatVatBaseDebitCC>
      //     <CInvoiceVatVatBaseCreditCC>0.0000</CInvoiceVatVatBaseCreditCC>
      //     <CInvoiceVatVatDebitLC>${item.tax_amount}</CInvoiceVatVatDebitLC>
      //     <CInvoiceVatVatCreditLC>0.0000</CInvoiceVatVatCreditLC>
      //     <CInvoiceVatVatDebitTC>${item.tax_amount}</CInvoiceVatVatDebitTC>
      //     <CInvoiceVatVatCreditTC>0.0000</CInvoiceVatVatCreditTC>
      //     <CInvoiceVatVatDebitCC>${item.tax_amount}</CInvoiceVatVatDebitCC>
      //     <CInvoiceVatVatCreditCC>0.0000</CInvoiceVatVatCreditCC>
      //     <CInvoiceVatIsTaxable>false</CInvoiceVatIsTaxable>
      //     <CInvoiceVatNonRecTaxAmtTC>0.0000</CInvoiceVatNonRecTaxAmtTC>
      //     <CInvoiceVatIsUpdAllow>true</CInvoiceVatIsUpdAllow>
      //     <CInvoiceVatIsAbsRet>false</CInvoiceVatIsAbsRet>
      //     <CInvoiceVatIsAccrRcpUs>false</CInvoiceVatIsAccrRcpUs>
      //     <CInvoiceVatTaxTrType>${item.tarif}</CInvoiceVatTaxTrType>
      //     <CInvoiceVatIsRevCharge>false</CInvoiceVatIsRevCharge>
      //     <CInvoiceVatUILinkedRowID>0</CInvoiceVatUILinkedRowID>
      //     <CInvoiceVatSequence>0</CInvoiceVatSequence>
      //     <CInvoiceVatNTBaseDebitTC>0.0000</CInvoiceVatNTBaseDebitTC>
      //     <CInvoiceVatNTBaseCreditTC>0.0000</CInvoiceVatNTBaseCreditTC>
      //     <CInvoiceVatIsSuspDel>false</CInvoiceVatIsSuspDel>
      //     <CInvoiceVatSuspDelTaxAmtTC>0.0000</CInvoiceVatSuspDelTaxAmtTC>
      //     <TxuTaxUsage>${item.jenis_pajak}</TxuTaxUsage>
      //     <TxenvTaxEnv>IDN</TxenvTaxEnv>
      //     <TxclTaxCls/>
      //     <TxtyTaxType>${type?.tx2_tax_type ?? ''}</TxtyTaxType>
      //     <tdCInvoiceVatVatBaseDebitVC>${item.tax_based}</tdCInvoiceVatVatBaseDebitVC>
      //     <tdCInvoiceVatVatBaseCreditVC>0.0000</tdCInvoiceVatVatBaseCreditVC>
      //     <tdCInvoiceVatVatDebitVC>${item.tax_amount}</tdCInvoiceVatVatDebitVC>
      //     <tdCInvoiceVatVatCreditVC>0.0000</tdCInvoiceVatVatCreditVC>
      //     <tlIsRecalculateTax>false</tlIsRecalculateTax>
      //     <tcDomainCode>${domain}</tcDomainCode>
      //     <tcVatInOut>INPUT</tcVatInOut>
      //     <tcVatCode>${item.jenis_pajak}</tcVatCode>
      //     <tcNormalTaxDivisionCode/>
      //     <tcAbsRetTaxGLCode/>
      //     <tcAbsRetTaxDivisionCode/>
      //     <tcSuspDelTaxGLCode/>
      //     <tcSuspDelTaxDivisionCode/>
      //     <tlTx2InvDisc>false</tlTx2InvDisc>
      //     <tc_Rowid>${index + 1}</tc_Rowid>
      //     <tc_ParentRowid>1</tc_ParentRowid>
      //   </tCInvoiceVat>
      // `;

      return  `
        <tCInvoiceVat>
          <TxclTaxCls>${item.tax_class ?? ''}</TxclTaxCls>
          <TxuTaxUsage>${item.jenis_pajak ?? ''}</TxuTaxUsage>
          <TxenvTaxEnv>IDN</TxenvTaxEnv>
          <tcVatCode>${item?.tax_code ?? ''}</tcVatCode>
          <tcDomainCode>${domain}</tcDomainCode>
          <CInvoiceVatVatBaseDebitTC>${item.tax_based}</CInvoiceVatVatBaseDebitTC>
          <CInvoiceVatVatDebitTC>${item.tax_amount}</CInvoiceVatVatDebitTC>
          <CInvoiceVatIsTaxable>false</CInvoiceVatIsTaxable>
          <CInvoiceVatIsUpdAllow>true</CInvoiceVatIsUpdAllow>
          <CInvoiceVatIsAbsRet>false</CInvoiceVatIsAbsRet>
          <CInvoiceVatIsAccrRcpUs>false</CInvoiceVatIsAccrRcpUs>
          <CInvoiceVatIsRevCharge>false</CInvoiceVatIsRevCharge>
          <CInvoiceVatUILinkedRowID>0</CInvoiceVatUILinkedRowID>
          <CInvoiceVatSequence>${index}</CInvoiceVatSequence>
          <CInvoiceVatIsSuspDel>false</CInvoiceVatIsSuspDel>
          <tdCInvoiceVatVatBaseDebitVC>${item.tax_based}</tdCInvoiceVatVatBaseDebitVC>
          <tdCInvoiceVatVatDebitVC>${item.tax_amount}</tdCInvoiceVatVatDebitVC>
          <tlIsRecalculateTax>false</tlIsRecalculateTax>
      	  <tcNormalTaxGLCode>${item?.tax_acct ?? ''}</tcNormalTaxGLCode>
          <TxtyTaxType>${item?.tax_type ?? ''}</TxtyTaxType>
          <CInvoiceVatTaxTrType>22</CInvoiceVatTaxTrType>
          <tcVatInOut>INPUT</tcVatInOut>
          <tlTx2InvDisc>false</tlTx2InvDisc>
          <tc_Rowid>${index + 1}</tc_Rowid>
          <tc_ParentRowid>1</tc_ParentRowid>
        </tCInvoiceVat>
      `;
    })
  );

  inv_tax_xml = taxXmlList.join('');
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns="urn:schemas-qad-com:xml-services"
    xmlns:qcom="urn:schemas-qad-com:xml-services:common"
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsa="http://www.w3.org/2005/08/addressing">
      <soapenv:Header>
        <wsa:Action/>
        <wsa:To>urn:services-qad-com:${receiverName}</wsa:To>
        <wsa:MessageID>urn:services-qad-com::${receiverName}</wsa:MessageID>
        <wsa:ReferenceParameters>
          <qcom:suppressResponseDetail>false</qcom:suppressResponseDetail>
        </wsa:ReferenceParameters>
        <wsa:ReplyTo>
          <wsa:Address>urn:services-qad-com:</wsa:Address>
        </wsa:ReplyTo>
      </soapenv:Header>
      <soapenv:Body>
        <${schemaName}>
          <qcom:dsSessionContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>domain</qcom:propertyName>
              <qcom:propertyValue>${domain}</qcom:propertyValue>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>scopeTransaction</qcom:propertyName>
              <qcom:propertyValue>false</qcom:propertyValue>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>version</qcom:propertyName>
              <qcom:propertyValue>${version}</qcom:propertyValue>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>mnemonicsRaw</qcom:propertyName>
              <qcom:propertyValue>false</qcom:propertyValue>
            </qcom:ttContext>
            
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>username</qcom:propertyName>
              <qcom:propertyValue>${process.env.INBOUND_USER}</qcom:propertyValue>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>password</qcom:propertyName>
              <qcom:propertyValue>${process.env.INBOUND_PASS}</qcom:propertyValue>
            </qcom:ttContext>
            
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>action</qcom:propertyName>
              <qcom:propertyValue>Save</qcom:propertyValue>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>entity</qcom:propertyName>
              <qcom:propertyValue>${entity}</qcom:propertyValue>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>email</qcom:propertyName>
              <qcom:propertyValue/>
            </qcom:ttContext>
            <qcom:ttContext>
              <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
              <qcom:propertyName>emailLevel</qcom:propertyName>
              <qcom:propertyValue/>
            </qcom:ttContext>
          </qcom:dsSessionContext>
          <BCInvoice>
            <tContextInfo>
              <tcCompanyCode>${entity}</tcCompanyCode>
              <tcCBFVersion>9.2</tcCBFVersion>
              <tcActivityCode>Create</tcActivityCode>
              <tlPartialUpdate>false</tlPartialUpdate>
              <tcPartialUpdateExceptionList/>
            </tContextInfo>
            <tCInvoice>
              <CInvoicePostingDate>${body.created_date}</CInvoicePostingDate>
              <CInvoiceType>Invoice</CInvoiceType>
              <CInvoiceDate>${body.created_date}</CInvoiceDate>
              <CInvoiceReference>${body.allocation_key}</CInvoiceReference>
              <CInvoiceDescription>${body.description}</CInvoiceDescription>
              <CInvoiceOriginalCreditTC>${body.is_taxable ? body.tc_amount_new : body.tc_amount}</CInvoiceOriginalCreditTC>
              <CInvoiceAllocationStatus>${body.allocation_status || ''}</CInvoiceAllocationStatus>
              <CInvoicePostingPeriod>${body.created_date_month}</CInvoicePostingPeriod>
              <CInvoicePostingYear>${body.created_date_year}</CInvoicePostingYear>
              <CInvoicePostingYearPeriod>${body.created_date_year_month}</CInvoicePostingYearPeriod>
              <CInvoiceIsTaxable>${body.is_taxable}</CInvoiceIsTaxable>
              <CInvoiceDayBookSetCode>${body.dayboookSetCode}</CInvoiceDayBookSetCode>
              <CInvoiceCreationDate>${body.created_date}</CInvoiceCreationDate>
              <tcCreditorCode>${body.suppbank_nbr}</tcCreditorCode>
              <CInvoicePoDomain>${domain}</CInvoicePoDomain>
              <tcBusinessRelationCode>${body.suppbank_nbr}</tcBusinessRelationCode>
              <tcDivisionCode/>
              <tcJournalCode>${body.daybook}</tcJournalCode>
              <tcCurrencyCode>${body.currency}</tcCurrencyCode>          
              <tcReasonAllocationStatus>${body.allocation_status || ''}</tcReasonAllocationStatus>
              <tcReasonCode>${body.inv_status}</tcReasonCode>
              <CInvoiceDueDate>${body.due_date_inv}</CInvoiceDueDate>
              <tcCostCentreCode/>
              <CInvoiceCommentNote>${body.comment || ''}</CInvoiceCommentNote>
              <CustomLong1></CustomLong1>
              <tc_Rowid>1</tc_Rowid>
              <tc_ParentRowid/>

              <tCInvoiceBank>
                <tcOwnBankNumber>${body.own_bank_number}</tcOwnBankNumber>
                <tcPayFormatTypeCode>AP_Transfer</tcPayFormatTypeCode>
                <tcPayFormatTypePayInstrument>Check</tcPayFormatTypePayInstrument>
                <tlValidatePayment>true</tlValidatePayment>
                <tcBankNumber>${body.suppbank_nbr}</tcBankNumber>
                <tcBankNumberExtension/>
                <tcBankNumberFormatted>${body.suppbank_nbr}</tcBankNumberFormatted>
                <tcBankNumberSwiftCode/>
                <tcBankNumberValidation>XX</tcBankNumberValidation>
                <tcBusinessRelationCode/>
                <tcOwnGLCode>${body.bank_gl_account}</tcOwnGLCode>
                <tcOwnBankCurr>${body.currency}</tcOwnBankCurr>
                <tcSupplierCurrency/>
                <tc_Rowid>1</tc_Rowid>
                <tc_ParentRowid>1</tc_ParentRowid>
              </tCInvoiceBank>
        
              ${inv_tax_xml}

            </tCInvoice>
          </BCInvoice>
        </${schemaName}>
      </soapenv:Body>
    </soapenv:Envelope>`;
  console.log(xml)
  const response = await axios.post(process.env.URL_INBOUND, xml, {
    headers: {
      "Content-Type": "application/xml",
      SOAPAction: "",
    },
  });

  const xmljs = await xmlToJs(response.data);
  const bodyXml = xmljs['soapenv:Envelope']['soapenv:Body'][0];
  const responseXml = bodyXml['ns1:bcinvoiceResponse'][0];
  const status = responseXml['ns1:result'][0];

  if (status === "success" || status === "warning") {
    return {
      status: "ok"
    };
  } else {
    const exceptions = responseXml['ns3:dsExceptions'][0];
    const errorList = exceptions['ns3:temp_err_msg'];
    const errorMessages = exceptions['ns3:temp_err_msg'].map(err => err['ns3:tt_msg_desc'][0]);

    const taxErrorDataList = errorList.filter(err => {
        const field = err['ns3:tt_msg_field']?.[0]?.toLowerCase() || '';
        return field.includes('tax code');
      }).map(err => err['ns3:tt_msg_data']?.[0]).filter(Boolean);
    const taxErrorMessages = taxErrorDataList.map(code => `${code}`);

    return {
      status: "error",
      message: taxErrorDataList ? [`Gagal melakukan penyimpanan data dan mengirim ke qad, Tax Code ${taxErrorMessages} tidak ditemukan`] : errorMessages,
    };
  }
};

export const inbound_pettycash_non_perjalanan_dinas = async (body) => {
  const schemaName = 'bcashbox';
	const version = 'ERP3_1';
  const receiverName = 'WNRLIVE';

  let domain  = '120';
  let entity = '1201';

  if (body.allocation_status === 'Unallocated' || !body.allocation_status) {
    body.allocation_status = 'UNALLOC';
  }

  // get last account balance
  const argsWsa = {
    parDomain: domain,
    parAccount: body.gl,
  };
  const callWsa = await getWSA(process.env.WSA, "getDBCAccountBalance", argsWsa);
  if (!callWsa || !callWsa.tt_accbal) {
    return {
      status: "error",
      message: 'Gagal melakukan penyimpanan data dan mengirim ke qad, Get Wsa Account Balance dengan gl tersebut tidak ditemukan',
    };
  }
  const resWsaAccountBalance = callWsa.tt_accbal ? callWsa.tt_accbal.tt_accbalRow[0] : [];

  if (!resWsaAccountBalance) {
    return {
      status: "error",
      message: 'Gagal melakukan penyimpanan data dan mengirim ke qad, Get Wsa Account Balance dengan gl tersebut tidak ditemukan',
    };
  }
  // end get last account balance
  let tc_amount_new = body.is_taxable ? body.tc_amount_new : body.tc_amount;
  body.closeBalance = resWsaAccountBalance.ttclosebal - tc_amount_new;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
  <soapenv:Envelope xmlns="urn:schemas-qad-com:xml-services"
  xmlns:qcom="urn:schemas-qad-com:xml-services:common"
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <soapenv:Header>
      <wsa:Action/>
      <wsa:To>urn:services-qad-com:${receiverName}</wsa:To>
      <wsa:MessageID>urn:services-qad-com::${receiverName}</wsa:MessageID>
      <wsa:ReferenceParameters>
        <qcom:suppressResponseDetail>true</qcom:suppressResponseDetail>
      </wsa:ReferenceParameters>
      <wsa:ReplyTo>
        <wsa:Address>urn:services-qad-com:</wsa:Address>
      </wsa:ReplyTo>
    </soapenv:Header>
    <soapenv:Body>
      <${schemaName}>
        <qcom:dsSessionContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>domain</qcom:propertyName>
            <qcom:propertyValue>${domain}</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>scopeTransaction</qcom:propertyName>
            <qcom:propertyValue>false</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>version</qcom:propertyName>
            <qcom:propertyValue>${version}</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>mnemonicsRaw</qcom:propertyName>
            <qcom:propertyValue>false</qcom:propertyValue>
          </qcom:ttContext>
          
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>username</qcom:propertyName>
            <qcom:propertyValue>${process.env.INBOUND_USER}</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>password</qcom:propertyName>
            <qcom:propertyValue>${process.env.INBOUND_PASS}</qcom:propertyValue>
          </qcom:ttContext>
          
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>action</qcom:propertyName>
            <qcom:propertyValue>Save</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>entity</qcom:propertyName>
            <qcom:propertyValue>${entity}</qcom:propertyValue>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>email</qcom:propertyName>
            <qcom:propertyValue/>
          </qcom:ttContext>
          <qcom:ttContext>
            <qcom:propertyQualifier>QAD</qcom:propertyQualifier>
            <qcom:propertyName>emailLevel</qcom:propertyName>
            <qcom:propertyValue/>
          </qcom:ttContext>
        </qcom:dsSessionContext>
        <BCashBox>
          <tContextInfo>
            <tcCompanyCode>${entity}</tcCompanyCode>
            <tcInvolvedCompanyCodes>${entity}</tcInvolvedCompanyCodes>
            <tcCBFVersion>9.2</tcCBFVersion>
            <tcActivityCode>Create</tcActivityCode>
            <tlPartialUpdate>false</tlPartialUpdate>
            <tcPartialUpdateExceptionList/>
          </tContextInfo>
          <tBankState>
            <tcGLCode>${body.gl}</tcGLCode>
            <BankStateYear>${body.created_date_year}</BankStateYear>
            <BankStateStatus>${body.allocation_status}</BankStateStatus>
            <BankStatePostingDate>${body.created_date}</BankStatePostingDate>
            <tiPeriodYear>${body.created_date_year}</tiPeriodYear>
            <tiPeriodPeriod>${body.created_date_month}</tiPeriodPeriod>
            <tcGLJournalCode>${body.daybook}</tcGLJournalCode>	
            <BankStateTransactionType>CASH</BankStateTransactionType>
            <BankStateMovement>-${tc_amount_new}</BankStateMovement>
            <BankStateClosingBalance>${body.closeBalance}</BankStateClosingBalance>
            <tBankStateLine>
              <BankStateLineNumber>1</BankStateLineNumber>
              <BankStateLineValueDate>${body.created_date}</BankStateLineValueDate>
              <BankStateLinePostingDate>${body.created_date}</BankStateLinePostingDate>
              <BankStateLineDescription>${body.description}</BankStateLineDescription>
              <BankStateLineAmountTC>-${tc_amount_new}</BankStateLineAmountTC>
              <BankStateLineInOut>-</BankStateLineInOut>
              <BankStateLineStatus>${body.allocation_status}</BankStateLineStatus>
              <tiPostingPeriodYear>${body.created_date_year}</tiPostingPeriodYear>
              <tcPostingJournalCode>${body.daybook}</tcPostingJournalCode>
              <tiPeriodYear>${body.created_date_year}</tiPeriodYear>
              <tiPeriodPeriod>${body.created_date_month}</tiPeriodPeriod>
              <tdBankStateLineAmountLC>-${tc_amount_new}</tdBankStateLineAmountLC>
            </tBankStateLine>
          </tBankState>
        </BCashBox>
      </${schemaName}>
    </soapenv:Body>
  </soapenv:Envelope>`;

  const response = await axios.post(process.env.URL_INBOUND, xml, {
    headers: {
      "Content-Type": "application/xml",
      SOAPAction: "",
    },
  });

  const xmljs = await xmlToJs(response.data);
  const bodyXml = xmljs['soapenv:Envelope']['soapenv:Body'][0];
  const responseXml = bodyXml['ns1:bcashboxResponse'][0];
  const status = responseXml['ns1:result'][0];

  if (status === "success" || status === "warning") {
    return {
      status: "ok"
    };
  } else {
    const exceptions = responseXml['ns3:dsExceptions'][0];
    const errorMessages = exceptions['ns3:temp_err_msg'].map(err => err['ns3:tt_msg_desc'][0]);
    return {
      status: "error",
      message: errorMessages,
    };
  }
};