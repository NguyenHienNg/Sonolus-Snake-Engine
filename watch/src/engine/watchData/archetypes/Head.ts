import { options } from "../../configuration.js"
import { skin } from '../../../../../shared/skin.js'
import { pos, game, apple, body } from "./Shared.js"
import { scaleToGrid as tg, layout, floatingEffect, drawScore, drawDpad, dpadInitialize, HeadAppearAnimation } from "../../../../../shared/utilities.js"
import { archetypes } from "./index.js"

export class Head extends Archetype {


  updateSequentialOrder = 0

  spawnTime() { return -999999 }
  despawnTime() { return 999999 }


  //entity memory
  nextTickTime = this.entityMemory(Number)
  borderAlert = this.entityMemory(Boolean)
  hasWrapped = this.entityMemory(Boolean)
  blink = this.entityMemory(Number)
  oldPos = this.entityMemory({
    x: Number,
    y: Number
  })

  layoutAppear = this.entityMemory(Rect) //used for the tp animatipn with the no walls option

  dpadLayout = this.entityMemory({
    up: Rect,
    down: Rect,
    left: Quad,
    right: Quad
  })

  scoreUpdateTime = this.entityMemory(Number)
  scoreLayouts = this.entityMemory({
    digit1: Rect,
    digit2: Rect,
    digit3: Rect,
    title: Rect
  })


  preprocess() {
    ui.menu.set({
      anchor: screen.rect.shrink(0.05, 0.05).rt,
      pivot: { x: 1, y: 1 },
      size: new Vec(0.15, 0.15).mul(ui.configuration.menu.scale),
      rotation: 0,
      alpha: ui.configuration.menu.alpha,
      horizontalAlign: HorizontalAlign.Center,
      background: true,
    })

    // ui.progress.set({
    //     anchor: screen.rect.lb.add(new Vec(0.05, 0.05)),
    //     pivot: { x: 0, y: 0 },
    //     size: { x: screen.rect.w - 0.1, y: 0.15 * ui.configuration.progress.scale },
    //     rotation: 0,
    //     alpha: ui.configuration.progress.alpha,
    //     horizontalAlign: HorizontalAlign.Center,
    //     background: true,
    // })

    game.size = 3
    pos.x = 1
    pos.y = 3
    game.tickDuration = 0.4

    archetypes.Body.spawn({})
    body.pos.set(0, 413)
    body.tickLeft.set(0, 3)
  }


  initialize() {
    if (options.dpad) dpadInitialize(this.dpadLayout)

    this.oldPos.x = pos.x
    this.oldPos.y = pos.y
  }


  updateSequential() {

    //tick logic
    game.isTick = false
    if (this.nextTickTime < time.now && !game.lose) {
      this.nextTickTime = time.now + game.tickDuration
      this.onTick()
    }

    this.drawGame()
  }

  onTick() {
    this.hasWrapped = false

    game.isTick = true
    game.tick++

    this.checkData(game.dataDir)
    game.dataDir = 0
    this.checkData(game.dataDir2)
    game.dataDir2 = 0

    //move head ➡️
    this.oldPos.x = pos.x
    this.oldPos.y = pos.y
    switch (game.dir) {
      case 4: pos.x++; break
      case 2: pos.x--; break
      case 1: pos.y++; break
      case 3: pos.y--; break
    }

    //wrap 🧱
    if (Math.max(pos.x, pos.y) > 9 || Math.min(pos.x, pos.y) < 0) {
      if (options.noWall) {
        //wrap to the other side
        pos.x = ((pos.x % 10) + 10) % 10
        pos.y = ((pos.y % 10) + 10) % 10
        this.hasWrapped = true
      }
    }

    // blinking border animation 
    if (!options.noWall) this.borderAlert = (Math.max(pos.x, pos.y) > 8 || Math.min(pos.x, pos.y) < 1)

    //randomly blink 👁️
    if (Math.random() >= 0.08) this.blink = time.now + 0.5
  }


  checkData(dir: number) {

    //load saved data, remember that game.dataDir was set
    //during previous tick and will be updated this frame after head updateSequential
    if (dir > 0) {

      //direction change
      if (dir <= 4) game.dir = dir

      //apple eating🍏
      if (Math.floor(dir * 0.01) == 5) {
        apple.x = Math.floor((dir % 100) * 0.1)
        apple.y = dir % 10
        if (game.tick > 1) {
          game.size++
          if (game.size % 5 == 0) game.tickDuration = Math.max(0.1, game.tickDuration - 0.025)
          this.scoreUpdateTime = time.now + 0.5
        }
      }

      //losing 
      if (dir == 6) {
        game.lose = true
        game.dir = 0
        game.nextTickAnimationProgress = 0
        game.deathTime = time.now
      }
    }
  }


  drawGame() {

    //draw the dead snake's head 💀
    if (game.lose) {

      //shake camera (grid)
      const shake = Math.pow(Math.max(game.deathTime + 1 - time.now, 0) * 0.1, 2)
      skin.sprites.grid.draw(layout.grid.translate(Math.randomFloat(-shake, shake), Math.randomFloat(-shake, shake)), 2, 1)

      //draw head dead 💀
      skin.sprites.headDead.draw(layout.sqaure
        .translate(tg(this.oldPos.x), tg(this.oldPos.y) + 0.02), 50, 1)
      skin.sprites.shadow.draw(layout.line
        .translate(tg(this.oldPos.x), tg(this.oldPos.y) - 0.07), 39, 1)
    }

    //draw the snake's head alive ♥️
    else {

      //progress value for the lerp animation for head and body
      game.nextTickAnimationProgress = (time.now - this.nextTickTime + game.tickDuration) / game.tickDuration

      //draw head appearing from other side if the snake passed through a wall
      if (this.hasWrapped) {
        HeadAppearAnimation(this.layoutAppear, pos, game.dir, game.nextTickAnimationProgress)
        skin.sprites.head.draw(this.layoutAppear, 50, 1)
        skin.sprites.shadow.draw(this.layoutAppear.translate(0, -0.02), 39, 1)
      }

      //draw the head normally
      else {
        skin.sprites.head.draw(
          layout.sqaure.translate(
            tg(Math.lerp(this.oldPos.x, pos.x, game.nextTickAnimationProgress)),
            tg(Math.lerp(this.oldPos.y, pos.y, game.nextTickAnimationProgress)) + 0.02,
          ), 50, 1)

        //eyelid animation 
        const a = Math.max(0, Math.min(0.04, (((this.blink - time.now) * -1) * 0.05)))
        skin.sprites.eyelid.draw(layout.line.translate(
          tg(Math.lerp(this.oldPos.x, pos.x, game.nextTickAnimationProgress)),
          tg(Math.lerp(this.oldPos.y, pos.y, game.nextTickAnimationProgress)) + 0.09 - a),
          51, 1)

        //shadow below the head
        skin.sprites.shadow.draw(layout.line.translate(tg(Math.lerp(this.oldPos.x, pos.x, game.nextTickAnimationProgress)), tg(Math.lerp(this.oldPos.y, pos.y, game.nextTickAnimationProgress)) - 0.07), 39, 1)
      }

      //drawing the blinking border
      if (this.borderAlert && (Math.floor(time.now * 5) % 2 === 0)) skin.sprites.borderDanger.draw(layout.gridBorder, 4, 0.5)

      //draw time limit progress bar
      if (options.timeLimit != 0) skin.sprites.shadow.draw(new Rect({ l: screen.l, r: Math.remap(0, options.timeLimit, screen.r, screen.l, time.now), b: screen.t - 0.04, t: screen.t }), 120, 1)
    }

    //draw apple 🍎
    if (time.now > 0) skin.sprites.apple.draw(
      floatingEffect(layout.sqaure)
        .translate(tg(apple.x), tg(apple.y) + 0.02), 50, 1)

    //draw grid ⬜
    skin.sprites.grid.draw(layout.grid, 1, 1)
    skin.sprites.border.draw(layout.gridBorder, 3, 1)

    //draw UI
    if (options.dpad) drawDpad(this.dpadLayout, game.dir)
    drawScore(Math.min(999, game.size - 3), this.scoreLayouts, this.scoreUpdateTime - time.now)
  }

}
