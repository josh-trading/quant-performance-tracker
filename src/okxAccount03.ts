"use strict"

import { Client } from "@notionhq/client";
import { datatype, account, market, trade } from "doraemon-quant-sdk";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import * as key from "../configs/key";

export const trackBalance = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {

  // Track balance
  try {
    const accountOKX: datatype.account.account = {info: new datatype.account.metadata({
      exchange: "OKX", 
      key: key.okxAcc1 as datatype.account.key
    })};
    const res = await account.info.getBalance(accountOKX, "copyTrade");
    console.log(res);

    const notion = new Client({
      auth: process.env.NOTION_TOKEN,
    });

    const response1 = await notion.databases.query({
      database_id: process.env.ACCOUNT_BALANCE_DATABASE,
    });
    // Return update successfully message

    console.log("Got response:", JSON.stringify(response1));

    const response2 = await notion.pages.create({
      "parent": {
        "type": "database_id",
        "database_id": process.env.ACCOUNT_BALANCE_DATABASE
      },
      "properties": {
          "Account": {
              "title": [
                  {
                      "text": {
                          "content": "OKX Account3(Non-holders)"
                      }
                  }
              ]
          },
          "Balance": {
              "number": parseFloat(res.data[0].totalEq)
          }
      }
    });

    console.log("Got response:", JSON.stringify(response2));
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