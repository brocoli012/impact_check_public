package com.example.product

import org.springframework.web.bind.annotation.*
import org.springframework.http.ResponseEntity

// Policy: Product API requires authentication
@RestController
@RequestMapping("/api/v1/products")
class ProductController(
    private val productService: ProductService
) {
    @GetMapping
    fun getProducts(): ResponseEntity<List<ProductResponse>> {
        return ResponseEntity.ok(productService.findAll())
    }

    @GetMapping("/{id}")
    fun getProduct(@PathVariable id: Long): ResponseEntity<ProductResponse> {
        return ResponseEntity.ok(productService.findById(id))
    }

    @PostMapping
    suspend fun createProduct(@RequestBody request: ProductRequest): ResponseEntity<ProductResponse> {
        return ResponseEntity.ok(productService.create(request))
    }

    @DeleteMapping("/{id}")
    fun deleteProduct(@PathVariable id: Long): ResponseEntity<Void> {
        productService.delete(id)
        return ResponseEntity.noContent().build()
    }
}
