# vheel

Show you how to create a vue3-similar framework step by step

通过一步步渐进式地做一个仿 Vue3 的轮子，来学习 Vue3 的源码。

## 简介

很多人对 Vue3 等前端框架是如何被创造的感兴趣，但是直接读源码来理解整体是很耗时间的活。

所以我想用一种正向的，渐进式的方法，来解释如何造一个类似 Vue3 的框架。

## 如何使用

每一个分支（branch）都包含，目前完成的，划分过的开发进度。同时，main 主干始终拥有最新的进度。

我建议使用时，先把整个 repo clone 到本地，从第一个分支`01-setup-dev-env`开始，跟随进度一起敲代码。

在 `vheel/playground/main.js`，我通常会创建一些 demo，来展示当前分支开发的新功能

想跑 demo 的话，先

`npm install`

之后

`npm run dev`

## 文章

对于每个分支，都有一篇对应的文章解释当前做了哪些工作以及为什么。

最早的版本会直接发在我的公众号上：`奔三程序员Club`。

建议你边看文章，边从第一个 branch 开始，从零敲代码造轮子，遇到不明白的时候再来看完成的 branch。
