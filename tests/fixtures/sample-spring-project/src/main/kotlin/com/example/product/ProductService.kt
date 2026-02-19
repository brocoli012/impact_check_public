package com.example.product

import org.springframework.stereotype.Service

@Service
class ProductService(
    private val productRepository: ProductRepository
) {
    fun findAll(): List<ProductResponse> {
        return productRepository.findAll().map { it.toResponse() }
    }

    fun findById(id: Long): ProductResponse {
        val product = productRepository.findById(id)
            .orElseThrow { RuntimeException("Product not found") }
        return product.toResponse()
    }

    suspend fun create(request: ProductRequest): ProductResponse {
        val product = Product(name = request.name, price = request.price)
        return productRepository.save(product).toResponse()
    }

    fun delete(id: Long) {
        productRepository.deleteById(id)
    }

    private fun Product.toResponse() = ProductResponse(id = this.id, name = this.name, price = this.price)
}
