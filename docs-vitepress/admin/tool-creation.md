---
title: Tool Creation Guide
description: Create custom AI tools without writing code
---

# Tool Creation Guide

Learn how to create powerful, custom AI tools for your team without any coding knowledge. Artemo's tool creation wizard makes it simple to build sophisticated AI-powered workflows.

---

## Overview

**What**: The tool creation system lets administrators build custom AI tools with specific question sequences, AI model preferences, and knowledge base integration.

**Why**: Create tools tailored to your organization's exact needs and workflows.

**Who**: Available to users with Admin role.

---

## Prerequisites

- ✅ Admin account access
- ✅ Clear understanding of the tool's purpose
- ✅ (Optional) Knowledge base files for tool context
- ✅ (Optional) Example outputs or templates

---

## The 3-Step Tool Creation Process

<ol class="step-guide">
<li>

### Step 1: Basic Tool Information

Define the tool's identity and visibility.

#### Required Fields

**Tool Name**
- Keep it clear and action-oriented
- Good: "Persuasive Product Email"
- Avoid: "Email Tool #1"

**Description**
- Explain what the tool does and when to use it
- 1-2 sentences, written for non-technical users
- Good: "Create compelling product launch emails that drive conversions with proven frameworks."

**Category**
- Select from existing categories or create a new one
- Categories help users find tools quickly
- Examples: Email Copy, Social Media, Sales Copy

#### Optional Fields

**Featured Tool**
- Toggle ON to display on the homepage
- Only feature your best, most-used tools

**Active Status**
- Toggle ON to make available to users
- Toggle OFF to hide without deleting

<div class="screenshot-placeholder">
📸 Screenshot: Tool creation step 1 - Basic information form
Location: /images/admin/tool-creation-step1.png
</div>

**Tips**:
- Use clear, benefit-driven language
- Think from the user's perspective: "What problem does this solve?"
- Test different names if users aren't finding the tool

</li>
<li>

### Step 2: AI Configuration

Configure how the AI processes user inputs.

#### AI Model Selection

**Primary Model**
Choose the main AI model for this tool:
- **Claude (Recommended)**: Better for creative, conversational content
- **GPT-4o-mini**: Faster, more structured responses

**Fallback Model**
Automatically used if primary model is unavailable:
- Ensures reliability
- Configured automatically based on primary choice

#### Custom Prompt Instructions

Provide system-level instructions that guide the AI's behavior.

**What to include**:
- Tone and style guidelines
- Format requirements
- Content structure preferences
- Brand voice characteristics
- Specific do's and don'ts

**Example Prompt Instructions**:
```
You are an expert email copywriter specializing in product launches.
Write in a conversational yet professional tone. Use the AIDA framework
(Attention, Interest, Desire, Action). Keep paragraphs short (2-3 sentences).
Include a clear call-to-action. Avoid jargon and corporate speak.
```

::: tip Pro Tip
The better your prompt instructions, the more consistent your tool's outputs. Invest time here!
:::

#### Knowledge Base Upload

Upload files that provide context for this specific tool:

**Supported formats**:
- PDF documents
- Word documents (.docx)
- Text files (.txt)
- Markdown files (.md)

**Good knowledge base files**:
- Brand guidelines
- Style guides
- Previous successful examples
- Industry-specific terminology
- Client background information

**Upload process**:
1. Click "Upload Knowledge Base File"
2. Select file(s) from your computer
3. Wait for processing (text extraction happens automatically)
4. Files are now available to the AI for this tool

<div class="screenshot-placeholder">
📸 Screenshot: AI configuration with model selection and KB upload
Location: /images/admin/tool-creation-step2.png
</div>

**Tips**:
- Upload high-quality example outputs
- Keep files focused and relevant
- Update files as your brand evolves

</li>
<li>

### Step 3: Question Sequence Builder

Create the conversation flow that guides users.

#### Question Types

**Text Input**
- Single-line responses
- Good for: Names, titles, short answers
- Example: "What is the product name?"

**Textarea**
- Multi-line responses
- Good for: Descriptions, lists, longer context
- Example: "Describe your target audience in detail"

**Select Dropdown**
- Predefined options
- Good for: Tone choices, formats, categorical data
- Example: "What tone should this email have?"
  - Professional
  - Casual
  - Persuasive
  - Friendly

#### Creating Questions

For each question, define:

**Label** (Question text shown to user)
- Be clear and specific
- Ask one thing at a time
- Use plain language

**Field Type**
- Choose from text, textarea, or select

**Required/Optional**
- Mark as required for critical information
- Optional for nice-to-have context

**Order**
- Drag and drop to reorder
- Logical flow: general → specific

#### Example Question Sequence

For a "Product Launch Email" tool:

1. **Product/Service Name** (Text, Required)
2. **Target Audience** (Textarea, Required)
   - "Describe your ideal customer"
3. **Key Benefits** (Textarea, Required)
   - "List 3-5 main benefits"
4. **Email Tone** (Select, Required)
   - Professional / Casual / Persuasive
5. **Call-to-Action** (Text, Required)
   - "What action should readers take?"
6. **Special Offers** (Textarea, Optional)
   - "Any discounts or limited-time offers?"

<div class="screenshot-placeholder">
�� Screenshot: Question sequence builder with drag-and-drop reordering
Location: /images/admin/tool-creation-step3.png
</div>

**Tips**:
- Start with essential questions, add optional ones later
- Test the sequence yourself before making it live
- Watch for question fatigue (5-8 questions is ideal)
- Provide example answers in placeholder text

</li>
</ol>

---

## After Creation

### Testing Your Tool

Before making it live:

1. Toggle tool to **Active: ON**
2. Open the tool as a regular user would
3. Complete the full question sequence
4. Review the AI output quality
5. Adjust prompt instructions or questions as needed

### Making It Live

1. Set **Active: ON**
2. Optionally set **Featured: ON** for homepage visibility
3. Announce to your team
4. Monitor usage and gather feedback

### Iterating and Improving

Tools can be edited anytime:
1. Go to Admin → Tools
2. Find your tool and click "Edit"
3. Make changes
4. Save - changes take effect immediately

---

## Best Practices

### Naming and Description

- **Action-Oriented Names**: "Create X" or "Generate Y"
- **Clear Benefits**: Tell users what they'll get
- **Keyword-Rich**: Help users find it in search

### Prompt Engineering

- **Be Specific**: Vague instructions = inconsistent results
- **Include Examples**: Show the AI what good looks like
- **Set Boundaries**: Tell the AI what NOT to do
- **Test and Refine**: Iterate based on real outputs

### Question Design

- **Logical Flow**: Group related questions together
- **Progressive Disclosure**: Start broad, get specific
- **Helpful Placeholders**: Show users what kind of answer you want
- **Avoid Redundancy**: Don't ask the same thing twice

### Knowledge Base

- **Quality Over Quantity**: 5 great examples > 50 mediocre ones
- **Keep Updated**: Refresh files as standards evolve
- **Relevant Content**: Only upload what's specific to this tool
- **Test Without It**: Ensure tool works even if KB isn't used

---

## Common Use Cases

### 1. Email Campaign Tool
**Questions**: Audience, product, benefits, tone, CTA
**AI Config**: Claude, AIDA framework instructions
**KB**: Previous successful email examples

### 2. Social Media Post Generator
**Questions**: Platform, topic, tone, hashtags, character limit
**AI Config**: GPT-4o-mini for speed, punchy writing style
**KB**: Brand voice guidelines

### 3. Client Proposal Builder
**Questions**: Client name, industry, services, pricing, timeline
**AI Config**: Claude, formal tone, structured format
**KB**: Proposal templates, case studies

### 4. Blog Post Outline Creator
**Questions**: Topic, audience, keywords, tone, length
**AI Config**: Claude, SEO-aware instructions
**KB**: Top-performing blog examples

---

## Troubleshooting

### Issue: Tool produces inconsistent outputs

**Solution**: Refine your prompt instructions. Be more specific about format, tone, and structure. Add examples to the knowledge base.

---

### Issue: Users skip required questions

**Solution**: Ensure questions are marked as "Required" in the builder. Check that validation is working by testing yourself.

---

### Issue: AI ignores knowledge base files

**Solution**: Verify files uploaded correctly and were processed (check for text extraction). Reference the KB explicitly in prompt instructions: "Use the uploaded brand guidelines to match tone and style."

---

### Issue: Tool takes too long to respond

**Solution**: Consider switching to GPT-4o-mini for faster responses. Reduce knowledge base file sizes. Simplify prompt instructions.

---

## Advanced Features

::: details Advanced: Dynamic Question Logic
In future updates, tools will support conditional questions that appear based on previous answers. Example: "If tone = Professional, ask for industry jargon preferences."
:::

::: details Advanced: Multi-Step Tools
Create tools with multiple output stages. Example: Generate outline → Review/Edit → Generate full content.
:::

::: details Advanced: API Integration
Tools can eventually integrate with external APIs for data enrichment. Example: Pull product data from your e-commerce platform.
:::

---

## Tool Creation Checklist

Before launching your tool:

- [ ] Clear, action-oriented name
- [ ] Benefit-driven description
- [ ] Appropriate category assignment
- [ ] Specific prompt instructions
- [ ] (If needed) Knowledge base files uploaded
- [ ] Logical question sequence (5-8 questions ideal)
- [ ] All required questions marked
- [ ] Tested personally with real inputs
- [ ] Output quality meets expectations
- [ ] Active status set to ON
- [ ] Team announcement prepared

---

## Related Resources

- [Category Management](/admin/categories) - Organize your tools
- [User Management](/admin/users) - Control who can access Pro tools
- [Analytics](/admin/analytics) - Track tool performance
- [Knowledge Base Guide](/tools/knowledge-base) - Optimize KB usage

---

## Need Help?

::: tip Get Expert Help
Need guidance creating your first tool? Our team can help you design and build custom tools for your workflow.

📧 Email: hello@artemo.ai
💬 Book a consultation: [Schedule a call](#)
:::

---

*Create unlimited tools tailored to your exact needs - no coding required!*

*Last updated: January 2025*
