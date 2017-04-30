# API List

|Method|Name|Description|Type|RequestJSON|ResponseJSON|
|:-|:-|:-|:-|:-|:-|
|**Message**|
|emit|enter:room|ルームに入場|JSON|`{ type: 0（チャネール） or １（DM）, from: 送ったユーザーのid, to: 入場したルームの名前 }`|||
|on|enter:room|ルームに入場|JSON||`{ message: 初めに入場する時に、既に登録された最新の２０件のメッセージ }`||
|emit|chat:room|ルームでチャットする|JSON|`{ type: 0（チャネール） or １（DM）, from: 送ったユーザーのid, to: 入場したルームの名前, body: チャットのメッセージ }`|||
|on|chat:room|ルームでチャットする|JSON||`{ message: チャットのメッセージ }`||
|emit|chat:room:edit|メッセージ修正|JSON|`{ id: 修正メッセージのid, body: 修正したメッセージ }`|||
|on|chat:room:edit|メッセージ修正|JSON||`{ status: "success" or "error", message: 修正したメッセージ }`||
|emit|chat:room:delete|メッセージを削除する|JSON|`{ id: 削除メッセージのid }`|||
|on|chat:room:delete|メッセージを削除する|JSON||`{ status: "success" or "error", message: 削除したメッセージ }`||
|emit|chat:room:reaction|メッセージにリアクションする|JSON|`{ id: メッセージのid, from: リアクションしたユーザーのid, emoji: 絵文字の番号 }`|||
|on|chat:room:reaction|メッセージにリアクションする|JSON||`{ status: "success" or "error", message: リアクションしたメッセージ }`||
