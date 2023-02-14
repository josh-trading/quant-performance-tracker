"use strict"

import { Client } from "@notionhq/client";
import { DynamoDB } from "aws-sdk";
import { datatype, account, market, trade } from "doraemon-quant-sdk";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import * as key from "../configs/key";
import param from "../configs/params.json";

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const getStrategyCache = async () => {  
  const dynamoDb = new DynamoDB.DocumentClient();
  const params = {
    TableName: param.eth03OkxTest.table.cache,
    Key: {
      strategy: param.eth03OkxTest.name
    },
  };

  const response = await dynamoDb.get(params).promise();
  return response;
}

async function sendPerfRecord(performance: number) {
  const response = await notion.pages.create({
    "parent": {
      "type": "database_id",
      "database_id": process.env.STRATEGY_BALANCE_DATABASE
    },
    "properties": {
        "Name": {
            "title": [
                {
                    "text": {
                        "content": "ETH01 - OKX Account1(Test)"
                    }
                }
            ]
        },
        "Balance": {
            "number": performance
        }
    }
  });

  console.log("Got response:", JSON.stringify(response));
}

export const trackBalance = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {

  // Track balance
  try {
    const response = await notion.databases.query({
      database_id: process.env.STRATEGY_BALANCE_DATABASE,
    });
    // Return update successfully message
    console.log("Got response:", JSON.stringify(response));

    // Get Current Position
    const parentOrder = await getStrategyCache();
    console.log(parentOrder);

    if (Object.keys(parentOrder).length === 1) {
      const strategyCache = parentOrder.Item;

      // Get copy trade position
      // Filter by parentOrder.Item.parentOrderId

      const accountOKX: datatype.account.account = {info: new datatype.account.metadata({
        exchange: "OKX", 
        key: key.okxAcc1 as datatype.account.key
      })};
  
      const getPosition = async () => {
        try {
            const position = await account.info.getPositionList(accountOKX, "copyTrade", {
              instId: [param.eth03OkxTest.order.symbol, param.eth03OkxTest.order.insType].join('-')
            });
            if (position.data.length) {
              return position.data.filter(
                position => position.subPosId == strategyCache.parentOrderId
              )[0];
            } else {
              return [];
            }
        } catch (err) {
          console.error("Unable to retrieve item. Error JSON:", JSON.stringify(err, null, 2));
          return [];
        }
      };

      const position = await getPosition();

      const symbolPrice = (await market.info.getTickerInfo(
        accountOKX,
        "future",
        {instType: param.eth03OkxTest.order.insType, instId: param.eth03OkxTest.order.symbol}
      )).data[0].last;
      console.log('Symbol Price: ', symbolPrice);

      const performance = (posSide: string) => {
        if (posSide=='long') {
          return (parseFloat(symbolPrice)/parseFloat(position.openAvgPx) - 1)
        } else if (posSide=='short') {
          return (1 - parseFloat(symbolPrice)/parseFloat(position.openAvgPx))
        }
      }

      await sendPerfRecord(performance(position.posSide));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
          message: "Order Execute Successfully!",
      })
    }
  } catch (err) {
    console.error(err)
    return {
      statusCode: err.statusCode || 501,
      body: JSON.stringify(
        {
          message: "Error Occured when executing order!",
          details: err,
        },
        null,
        2
      ),
    }
  }
}