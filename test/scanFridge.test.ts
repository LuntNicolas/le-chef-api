import type {Request, Response} from "express";
import fs from "fs"
import {describe, expect, it, vi} from "vitest"
import {scanFridge} from "../src/controllers/fridgeController.ts"

const image = fs.readFileSync("public/images/test-fridge.png").toString("base64")

vi.mock("@clerk/express", () => ({
    getAuth: vi.fn(() => ({userId: "Test-user"}))
}))

const req = {
    headers: {
        "content-type": "application/json"
    },
    body: JSON.stringify({image: image})
} as Request

const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    send: vi.fn(),
} as unknown as Response

describe("Test scan fridge", () => {
    it("Validate user", async () => {
        await scanFridge(req, res)
        expect(res.status).not.toHaveBeenCalledWith(404)
    })
    
})